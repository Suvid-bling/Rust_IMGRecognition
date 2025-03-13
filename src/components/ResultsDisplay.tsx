import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface RecognitionResult {
  label: string;
  confidence: number;
}

interface ResultsDisplayProps {
  results: RecognitionResult[];
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ results }) => {
  // Function to determine color based on confidence level
  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.7) return 'bg-green-500';
    if (confidence >= 0.4) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div>
      {results.length === 0 ? (
        <p className="text-gray-500 italic">No results yet. Select or capture an image to begin recognition.</p>
      ) : (
        <AnimatePresence>
          <ul className="space-y-2">
            {results.map((result, index) => (
              <motion.li
                key={`${result.label}-${index}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center justify-between bg-gray-50 rounded-lg p-3"
              >
                <span className="font-medium text-gray-800">{result.label}</span>
                <div className="flex items-center">
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden mr-3">
                    <div
                      className={`h-full ${getConfidenceColor(result.confidence)}`}
                      style={{ width: `${result.confidence * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-semibold">
                    {(result.confidence * 100).toFixed(1)}%
                  </span>
                </div>
              </motion.li>
            ))}
          </ul>
        </AnimatePresence>
      )}
    </div>
  );
};

export default ResultsDisplay;