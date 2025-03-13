import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';
import Camera from './components/Camera';
import ImageSelector from './components/ImageSelector';
import ResultsDisplay from './components/ResultsDisplay';
import LoadingIndicator from './components/LoadingIndicator';

// Define the RecognitionResult type to match the Rust backend
interface RecognitionResult {
  label: string;
  confidence: number;
}

// Input mode enum
enum InputMode {
  Camera = 'camera',
  Gallery = 'gallery',
}

function App() {
  const [inputMode, setInputMode] = useState<InputMode>(InputMode.Gallery);
  const [results, setResults] = useState<RecognitionResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modelInitialized, setModelInitialized] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    // Initialize the model when the app starts
    const initModel = async () => {
      try {
        setIsLoading(true);
        await invoke('init_model');
        setModelInitialized(true);
        setErrorMessage(null);
      } catch (error) {
        console.error('Failed to initialize model:', error);
        setErrorMessage(`Failed to initialize model: ${error}`);
      } finally {
        setIsLoading(false);
      }
    };

    initModel();
  }, []);


  const handleImageSelected = async (imagePath: string) => {
    if (!modelInitialized) {
      setErrorMessage('Model not initialized. Please wait and try again.');
      return;
    }

    try {
      setIsLoading(true);
      setSelectedImage(imagePath);
      setResults([]);

      const recognitionResults: RecognitionResult[] = await invoke('recognize_image', {
        imagePath,
      });

      setResults(recognitionResults);
      setErrorMessage(null);
    } catch (error) {
      console.error('Recognition failed:', error);
      setErrorMessage(`Recognition failed: ${error}`);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCameraCapture = async (imageData: string) => {
    if (!modelInitialized) {
      setErrorMessage('Model not initialized. Please wait and try again.');
      return;
    }

    try {
      setIsLoading(true);
      setResults([]);

      const recognitionResults: RecognitionResult[] = await invoke('recognize_image_data', {
        imageData,
      });

      setResults(recognitionResults);
      setErrorMessage(null);
    } catch (error) {
      console.error('Recognition failed:', error);
      setErrorMessage(`Recognition failed: ${error}`);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleInputMode = () => {
    setInputMode(
      inputMode === InputMode.Camera ? InputMode.Gallery : InputMode.Camera
    );
    // Clear previous results when switching modes
    setResults([]);
    setSelectedImage(null);
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-4">
      {/* Header */}
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-indigo-700">TauriVision</h1>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={toggleInputMode}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700 transition-colors"
        >
          {inputMode === InputMode.Camera ? 'Use Gallery' : 'Use Camera'}
        </motion.button>
      </header>

      <main className="flex-grow flex flex-col">
        {/* Input Section */}
        <div className="flex-grow mb-4 relative">
          <AnimatePresence mode="wait">
            {inputMode === InputMode.Camera ? (
              <motion.div
                key="camera"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full"
              >
                <Camera onCapture={handleCameraCapture} />
              </motion.div>
            ) : (
              <motion.div
                key="gallery"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full"
              >
                <ImageSelector onImageSelected={handleImageSelected} selectedImage={selectedImage} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Loading Overlay */}
          <AnimatePresence>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg"
              >
                <LoadingIndicator />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Error Message */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg"
            >
              {errorMessage}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results Section */}
        <div className="bg-white rounded-lg shadow-lg p-4 h-48 overflow-y-auto">
          <h2 className="text-lg font-medium text-gray-800 mb-2">Recognition Results</h2>
          <ResultsDisplay results={results} />
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-4 text-center text-gray-500 text-sm">
        <p>TauriVision Image Recognition App</p>
      </footer>
    </div>
  );
}

export default App;