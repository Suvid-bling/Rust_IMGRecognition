@echo off
REM Batch script to download and prepare model files for TauriVision
    Finished 1 APK at:
        C:\ComputerLearning\Android\tauri-android\Forlovev1.1\src-tauri\gen/android\app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk

    Finished 1 AAB at:
        C:\ComputerLearning\Android\tauri-android\Forlovev1.1\src-tauri\gen/android\app/build/outputs/bundle/universalRelease/app-universal-release.aab

setlocal EnableDelayedExpansion

REM Create directories if they don't exist
if not exist "assets\model" (
    mkdir assets\model
)

REM Download MobileNet v2 ONNX model
echo Downloading MobileNet v2 ONNX model...
curl -L -o assets\model\mobilenet_v2.onnx https://github.com/onnx/models/raw/main/vision/classification/mobilenet/model/mobilenetv2-7.onnx
if %ERRORLEVEL% neq 0 (
    echo Failed to download MobileNet v2 ONNX model.
    exit /b 1
)

REM Download ImageNet labels
echo Downloading ImageNet labels...
curl -L -o assets\model\labels_temp.txt https://raw.githubusercontent.com/pytorch/hub/master/imagenet_classes.txt
if %ERRORLEVEL% neq 0 (
    echo Failed to download ImageNet labels.
    exit /b 1
)

REM Format the labels file (removing non-alphabetic leading characters is trickier in batch)
REM We'll use findstr to filter lines, though it won't perfectly replicate sed
echo Formatting labels...
type assets\model\labels_temp.txt | findstr /r "^[a-zA-Z]" > assets\model\labels.txt
if %ERRORLEVEL% neq 0 (
    echo Failed to format labels.
    exit /b 1
)

REM Remove the temporary file
del assets\model\labels_temp.txt
if %ERRORLEVEL% neq 0 (
    echo Failed to delete temporary labels file.
    exit /b 1
)

echo Model setup completed successfully!
exit /b 0