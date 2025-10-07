'use client'

import React, { useState, useEffect } from 'react';
import { Bluetooth, StopCircle } from 'lucide-react';

interface SerialConnectionStatus {
  isConnected: boolean;
  port: SerialPort | null;
}

const SignTranslator: React.FC = () => {
  const [data, setData] = useState({});
  const [connectionStatus, setConnectionStatus] = useState<SerialConnectionStatus>({
    isConnected: false,
    port: null
  });
  const [translatedText, setTranslatedText] = useState<string>('');
  const [currentPrediction, setCurrentPrediction] = useState<string>('');
  const [animatedText, setAnimatedText] = useState<string>('');
  const [reader, setReader] = useState<ReadableStreamDefaultReader | null>(null);
  const [isReading, setIsReading] = useState<boolean>(true);

  useEffect(() => {
    fetch("/data.json")
      .then((response) => response.json())
      .then((json) => setData(json))
      .catch((error) => console.error("Erreur lors du chargement du JSON:", error));
  }, []);

  const connectToDevice = async () => {
    try {
      if (!("serial" in navigator)) {
        alert("Web Serial API non supporté par votre navigateur !");
        return;
      }

      const selectedPort = await navigator.serial.requestPort();
      await selectedPort.open({ baudRate: 9600 });
      
      setConnectionStatus({
        isConnected: true,
        port: selectedPort
      });
      
      console.log("✅ Connecté au HC-06");

      const portReader = selectedPort.readable?.getReader();
      if (!portReader) {
        throw new Error("Impossible de créer le reader");
      }
      
      setReader(portReader);
      startReading(portReader);

    } catch (error) {
      console.error("❌ Erreur de connexion :", error);
      setConnectionStatus({
        isConnected: false,
        port: null
      });
    }
  };

  const computeDistance = (v1: number[], v2: number[], size: number): number => {
    let d = 0;
    for (let i = 0; i < size; i++) {
      d += Math.pow(v2[i] - v1[i], 2);
    }
    return Math.sqrt(d);
  };
  
  const predict = (v: number[], size: number = 5): string => {
    let minLetter = "0";
    let minDistance = 1000;
  
    for (const letter in data) {
      if (data[letter].length !== size) {
        console.error(`Invalid data size for letter ${letter}`);
        continue;
      }
      
      const distance = computeDistance(data[letter], v, size);
      if (distance < minDistance) {
        minDistance = distance;
        minLetter = letter;
      }
    }
    
    return minLetter;
  };
  
  const startReading = async (portReader: ReadableStreamDefaultReader) => {
    try {
      while (true) {
        const { value, done } = await portReader.read();
        if (done) break;

        const text = new TextDecoder().decode(value);
        console.log("📡 Données reçues :", text);
        
        const parsedValues = text.split(';').map(Number);
        console.log('Parsed Values : ', parsedValues)

        if (parsedValues.length === 5) {
          const prediction = predict(parsedValues);
          console.log(prediction)
          setCurrentPrediction(prediction);
          if (prediction !== "0") { 
            setTranslatedText(prev => prev + prediction);
          }
        }
      }
    } catch (error) {
      console.error("❌ Erreur de lecture :", error);
    }
  };

  const stopConnection = async () => {
    try {
      if (reader) {
        await reader.cancel();
        setReader(null);
      }
      
      if (connectionStatus.port) {
        await connectionStatus.port.close();
      }
      
      setConnectionStatus({
        isConnected: false,
        port: null
      });
      
      setCurrentPrediction('');
      console.log("✅ Déconnecté");
    } catch (error) {
      console.error("❌ Erreur lors de la déconnexion :", error);
    }
  };

  const animateText = () => {
    let index = 0;
    const interval = setInterval(() => {
      if (index <= translatedText.length) {
        setAnimatedText(translatedText.slice(0, index));
        index++;
      } else {
        clearInterval(interval);
        
        // Après l'animation du texte, déclencher la lecture avec un décalage de 5 secondes
        setTimeout(() => {
          readText();
        }, 500);  // 5 secondes de décalage
      }
    }, 100);  // Délais entre chaque caractère pour l'animation
  };
  const stopTranslation = () => {
    // Annuler la lecture en cours
    resetText();
    speechSynthesis.cancel();
    setIsReading(false); // Mettre l'état `isReading` à false pour désactiver la lecture
  };
  
  
  const readText = () => {
    if (translatedText) {
      const utterance = new SpeechSynthesisUtterance(translatedText);
      speechSynthesis.speak(utterance);
    }
  };
  

  const resetText = () => {
    setTranslatedText('');
    setAnimatedText('');
    setCurrentPrediction('');
  };



  useEffect(() => {
    return () => {
      if (connectionStatus.isConnected) {
        stopConnection();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center">
      <div className="w-full max-w-2xl p-8 bg-white rounded-lg shadow-custom">
        <h1 className="text-3xl font-bold mb-6 text-center text-secondary-dark">
          Sign to Text Translation
        </h1>
        
        <div className="bg-gray-50 p-6 rounded-lg mb-6 min-h-[200px]">
          <div className="flex flex-col items-center gap-4">
            <div className="text-lg text-gray-600">
              Current Detection: 
              <span className="ml-2 text-2xl text-blue-500 font-bold">
                {currentPrediction || '-'}
              </span>
            </div>
            <div className="w-full">
              <p className="text-sm text-gray-500 mb-2">Translated Text:</p>
              <div className="p-4 bg-white rounded border min-h-[60px]">
                <p className="text-2xl text-blue-500 font-mono break-words">
                  {animatedText || translatedText || 'No text yet'}
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col w-full md:flex-row justify-around gap-2">
          <div className="flex justify-center gap-2">
            <button
              onClick={animateText}
              className="flex w-[200px] justify-center items-center p-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              disabled={!connectionStatus.isConnected || !translatedText}
            >
              Read Translation
            </button>
            {/* <button
              onClick={resetText}
              className="flex w-[200px] justify-center items-center p-4 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition"
              disabled={!translatedText}
            >
              Reset Text
            </button> */}
            <button
          onClick={stopTranslation}
          className="flex w-[200px] justify-center items-center p-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          disabled={!isReading}
        >
          Stop
        </button>
          </div>
          
          <div className="flex justify-center">
            {!connectionStatus.isConnected ? (
              <button
                onClick={connectToDevice}
                className="flex w-[200px] justify-center items-center p-4 bg-primary text-white rounded-lg hover:bg-primary-dark transition"
              >
                <Bluetooth className="mr-2" />
                Connect Device
              </button>
            ) : (
              <button
                onClick={stopConnection}
                className="flex w-[200px] justify-center items-center p-4 bg-accent text-white rounded-lg hover:bg-accent-dark transition"
              >
                <StopCircle className="mr-2" />
                Disconnect
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignTranslator;
