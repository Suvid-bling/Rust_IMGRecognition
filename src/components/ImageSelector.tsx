import React, { useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import { motion } from 'framer-motion';
import { platform } from '@tauri-apps/plugin-os';
import { invoke } from '@tauri-apps/api/core';

interface ImageSelectorProps {
  onImageSelected: (imagePath: string, imageData?: string) => void;
  selectedImage: string | null;
}

const ImageSelector: React.FC<ImageSelectorProps> = ({
  onImageSelected,
  selectedImage
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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

  // Set preview URL when selected image changes
  useEffect(() => {
    if (selectedImage && !selectedImage.startsWith('content://')) {
      setPreviewUrl(convertFileSrc(selectedImage));
    }
  }, [selectedImage]);

  const handleSelectImage = async () => {
    try {
      setIsLoading(true);

      // Open file dialog 
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Images',
          extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp']
        }]
      });

      if (selected) {
        let imagePath: string;

        if (Array.isArray(selected) && selected.length > 0) {
          imagePath = selected[0];
        } else if (typeof selected === 'string') {
          imagePath = selected;
        } else {
          throw new Error('Invalid selection');
        }

        // Check if it's a content URI (Android)
        if (imagePath.startsWith('content://')) {
          try {
            console.log('Processing content URI:', imagePath);

            // Use our custom command to read content URI
            const base64Data = await invoke<string>('read_content_uri', { uri: imagePath });

            // Create data URL (assuming JPEG for simplicity)
            const dataUrl = `data:image/jpeg;base64,${base64Data}`;

            // Set preview
            setPreviewUrl(dataUrl);

            // Pass both path and data URL to parent
            onImageSelected(imagePath, dataUrl);
          } catch (error) {
            console.error('Error reading content URI:', error);
            alert(`Failed to read image: ${error}`);
          }
        } else {
          // Regular file path
          setPreviewUrl(convertFileSrc(imagePath));
          onImageSelected(imagePath);
        }
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
      console.log('File dropped:', file.name);
      // Not implemented for this example
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
        {previewUrl ? (
          <div className="w-full h-full flex items-center justify-center">
            <img
              src={previewUrl}
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