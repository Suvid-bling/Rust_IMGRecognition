const fs = require('fs');
const path = require('path');

// Source and destination paths
const sourceDir = path.join(__dirname, 'src-tauri', 'scripts', 'assets', 'model');
const destDir = path.join(__dirname, 'src-tauri', 'assets', 'model');

// Create destination directory if it doesn't exist
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
  console.log(`Created directory: ${destDir}`);
}

// Copy model files
const modelFiles = ['mobilenet_v2.onnx', 'labels.txt'];
modelFiles.forEach(file => {
  const sourcePath = path.join(sourceDir, file);
  const destPath = path.join(destDir, file);
  
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, destPath);
    console.log(`Copied ${file} to ${destPath}`);
  } else {
    console.error(`Source file not found: ${sourcePath}`);
  }
});

console.log('Model files copied successfully');