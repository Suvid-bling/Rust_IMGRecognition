import React, { useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import { motion } from 'framer-motion';
import { getVersion, getTauriVersion } from '@tauri-apps/api/app';
import { platform } from '@tauri-apps/plugin-os';
import { invoke } from '@tauri-apps/api/core';

interface ImageSelectorProps {
  onImageSelected: (imagePath: string) => void;
  selectedImage: string | null;
}

const ImageSelector: React.FC<ImageSelectorProps> = ({
  onImageSelected,
  selectedImage
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check if running on mobile
  useEffect(() => {
    const checkPlatform = async () => {
      try {
        const currentPlatform = await platform();
        setIsMobileDevice(currentPlatform === 'android' || currentPlatform === 'ios');
      } catch (error) {
        console.error('Error checking platform:', error);
      }
    };

    checkPlatform();
  }, []);

  const handleSelectImage = async () => {
    try {
      setIsLoading(true);

      // On Android, you might need to request permissions first if you're using a plugin for that
      // For example, with tauri-plugin-mobile-permissions:
      if (isMobileDevice) {
        try {
          // This is a placeholder - you would use the actual permission API if implemented
          await invoke('request_storage_permission');
        } catch (error) {
          console.log('Permission API might not be available, continuing anyway:', error);
        }
      }

      // Open file dialog with retry logic for mobile devices
      let selected = null;
      let attempts = 0;
      const maxAttempts = 3;

      while (!selected && attempts < maxAttempts) {
        try {
          selected = await open({
            multiple: false,
            filters: [{
              name: 'Images',
              extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp']
            }]
          });
          attempts++;
        } catch (error) {
          console.log(`Attempt ${attempts} failed:`, error);
          // Small delay before retry
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      if (selected && typeof selected === 'string') {
        onImageSelected(selected);
      } else if (Array.isArray(selected) && selected.length > 0) {
        onImageSelected(selected[0]);
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      alert(`Failed to select image: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      // In a real Tauri app, we'd use the Tauri API to handle this file
      // This is a simplified example
      console.log('File dropped:', file.name);
      // In a real app, we'd convert this to a file path
      // For now, this is just a placeholder
      // onImageSelected(file.path);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div
        className={`flex-grow flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 transition-colors ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 bg-gray-50'
          }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {selectedImage ? (
          <div className="w-full h-full flex items-center justify-center">
            <img
              src={convertFileSrc(selectedImage)}
              alt="Selected"
              className="max-h-full max-w-full object-contain rounded"
            />
          </div>
        ) : (
          <>
            <svg
              className="w-16 h-16 text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              ></path>
            </svg>
            <p className="mb-2 text-lg font-medium text-gray-600">
              {isDragging ? 'Drop image here' : 'Select an image to recognize'}
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Supported formats: JPG, JPEG, PNG, GIF, WEBP
            </p>
          </>
        )}
      </div>

      <div className="mt-4 flex justify-center">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleSelectImage}
          disabled={isLoading}
          className={`px-6 py-3 bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700 transition-colors ${isLoading ? 'opacity-70 cursor-not-allowed' : ''
            }`}
        >
          {isLoading
            ? 'Loading...'
            : selectedImage
              ? 'Select Different Image'
              : 'Select Image'
          }
        </motion.button>
      </div>
    </div>
  );
};

export default ImageSelector;