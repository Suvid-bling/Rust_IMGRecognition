import React, { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { motion } from 'framer-motion';

interface CameraProps {
  onCapture: (imageData: string) => void;
}

const Camera: React.FC<CameraProps> = ({ onCapture }) => {
  const webcamRef = useRef<Webcam>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // More flexible video constraints
  const videoConstraints = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    facingMode,
  };

  // Reset camera state when facing mode changes
  useEffect(() => {
    setIsCameraReady(false);
    setErrorMessage(null);
  }, [facingMode]);

  // Handle successful camera initialization
  const handleUserMedia = useCallback(() => {
    console.log('Camera initialized successfully');
    setIsCameraReady(true);
    setErrorMessage(null);
  }, []);

  // Handle camera initialization errors
  const handleUserMediaError = useCallback((error: any) => {
    console.error('Camera error:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);

    setIsCameraReady(false);

    // Provide user-friendly error messages
    if (error.name === 'NotAllowedError') {
      setErrorMessage('Camera access denied. Please grant camera permissions in your device settings.');
    } else if (error.name === 'NotFoundError') {
      setErrorMessage(`The ${facingMode === 'user' ? 'front' : 'back'} camera is not available.`);
      // Try switching to the other camera
      setFacingMode(facingMode === 'user' ? 'environment' : 'user');
    } else if (error.name === 'NotReadableError') {
      setErrorMessage('The camera is already in use by another application.');
    } else {
      setErrorMessage(`Unable to access camera: ${error.message || 'Unknown error'}`);
    }
  }, [facingMode]);

  const handleCapture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      onCapture(imageSrc);
    }
  }, [onCapture]);

  const toggleCamera = () => {
    setFacingMode(prevMode =>
      prevMode === 'user' ? 'environment' : 'user'
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="relative flex-grow bg-black rounded-lg overflow-hidden">
        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          videoConstraints={videoConstraints}
          className="w-full h-full object-cover"
          onUserMedia={handleUserMedia}
          onUserMediaError={handleUserMediaError}
          mirrored={facingMode === 'user'}
          forceScreenshotSourceSize
        />

        {!isCameraReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 text-white p-4 text-center">
            {errorMessage || 'Loading camera...'}

            {errorMessage && (
              <button
                onClick={() => setFacingMode(facingMode === 'user' ? 'environment' : 'user')}
                className="mt-4 px-4 py-2 bg-indigo-600 rounded text-white"
              >
                Try {facingMode === 'user' ? 'back' : 'front'} camera
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-center gap-4">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleCapture}
          disabled={!isCameraReady}
          className="p-4 bg-indigo-600 rounded-full shadow-lg text-white disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10"></circle>
          </svg>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={toggleCamera}
          disabled={!isCameraReady}
          className="p-4 bg-gray-700 rounded-full shadow-lg text-white disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 4v6a3 3 0 0 1-3 3H4"></path>
            <path d="M9 20v-6a3 3 0 0 1 3-3h10"></path>
            <path d="m21 7-4-4"></path>
            <path d="m13 15-4 4"></path>
            <path d="m21 7-4 4"></path>
            <path d="m13 15-4-4"></path>
          </svg>
        </motion.button>
      </div>

      <div className="mt-2 text-center text-sm text-gray-600">
        <p>Tap the circle to capture, or the rotate button to switch camera</p>
      </div>
    </div>
  );
}

export default Camera;