use anyhow::{Context, Result};
use log::{error, info};
use once_cell::sync::OnceCell;
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Instant;
use thiserror::Error;

// Tract imports
use tract_onnx::prelude::*;

static CLASS_LABELS: OnceCell<Vec<String>> = OnceCell::new();

#[derive(Error, Debug)]
pub enum ModelError {
    #[error("Model not initialized")]
    NotInitialized,

    #[error("Failed to load model: {0}")]
    LoadError(String),

    #[error("Inference error: {0}")]
    InferenceError(String),
}

pub struct ModelManager {
    model:
        Option<Arc<RunnableModel<TypedFact, Box<dyn TypedOp>, Graph<TypedFact, Box<dyn TypedOp>>>>>,
    is_initialized: bool,
}

impl ModelManager {
    pub fn new() -> Self {
        Self {
            model: None,
            is_initialized: false,
        }
    }

    pub fn init(&mut self) -> Result<()> {
        // Get platform-specific paths
        let model_path = self.get_model_path();
        let labels_path = self.get_labels_path();

        info!("Loading model from {:?}", model_path);
        info!("Loading labels from {:?}", labels_path);

        // Load the model using the determined paths
        self.init_with_paths(model_path, labels_path)
    }

    // Get the appropriate model path based on platform
    fn get_model_path(&self) -> PathBuf {
        // Improved platform detection
        #[cfg(target_os = "android")]
        {
            println!("Running on Android, using Android-specific path");
            // For Android, use the path directly in assets without the "model" subdirectory
            PathBuf::from("mobilenet_v2.onnx")
        }

        #[cfg(not(target_os = "android"))]
        {
            println!("Running on desktop, using desktop-specific path");
            // For desktop, use the original path
            PathBuf::from("assets/model/mobilenet_v2.onnx")
        }
    }

    // Get the appropriate labels path based on platform
    fn get_labels_path(&self) -> PathBuf {
        #[cfg(target_os = "android")]
        {
            println!("Using Android-specific labels path");
            // For Android, use the path directly in assets without the "model" subdirectory
            PathBuf::from("labels.txt")
        }

        #[cfg(not(target_os = "android"))]
        {
            println!("Using desktop-specific labels path");
            // For desktop, use the original path
            PathBuf::from("assets/model/labels.txt")
        }
    }

    // Initialize with explicit paths (useful for Tauri's resource resolution)
    pub fn init_with_paths(&mut self, model_path: PathBuf, labels_path: PathBuf) -> Result<()> {
        // Log the full paths we're trying to use
        println!("Attempting to load model from: {:?}", model_path);
        println!("Attempting to load labels from: {:?}", labels_path);

        // Try to get the current working directory for debugging
        if let Ok(cwd) = std::env::current_dir() {
            println!("Current working directory: {:?}", cwd);
        }

        // Load and prepare the ONNX model
        let model_file = match File::open(&model_path) {
            Ok(file) => {
                println!("Successfully opened model file");
                file
            }
            Err(e) => {
                let error_msg = format!("Failed to open model file at {:?}: {}", model_path, e);
                println!("{}", error_msg);
                return Err(anyhow::anyhow!(error_msg));
            }
        };

        let mut model_file = model_file;

        // Try alternative paths for Android if the first attempt fails
        #[cfg(target_os = "android")]
        if model_file.metadata().map(|m| m.len() == 0).unwrap_or(true) {
            println!(
                "Empty model file or metadata access failed, trying alternative Android paths"
            );

            // Try with a different approach for Android asset loading
            // This would depend on how Tauri Android handles asset loading
            // You might need to use Tauri's asset APIs instead of direct file operations
        }

        let model = tract_onnx::onnx()
            // Log each step
            .model_for_read(&mut model_file)
            .with_context(|| {
                println!("Failed to load ONNX model");
                "Failed to load ONNX model"
            })?
            // Specify the input shape (1 batch, 3 channels, 224 height, 224 width)
            .with_input_fact(
                0,
                InferenceFact::dt_shape(f32::datum_type(), tvec!(1, 3, 224, 224)),
            )
            .with_context(|| {
                println!("Failed to set input shape");
                "Failed to set input shape"
            })?
            // Optimize the model
            .into_optimized()
            .with_context(|| {
                println!("Failed to optimize model");
                "Failed to optimize model"
            })?
            // Make the model runnable
            .into_runnable()
            .with_context(|| {
                println!("Failed to convert model to runnable");
                "Failed to convert model to runnable"
            })?;

        // Load class labels with more robust error handling
        match self.load_labels_from_path(&labels_path) {
            Ok(_) => println!("Labels loaded successfully"),
            Err(e) => println!("Warning: Failed to load labels: {}", e),
        }

        // Store the model
        self.model = Some(Arc::new(model));
        self.is_initialized = true;

        println!("Model initialized successfully");
        Ok(())
    }

    // Original load_labels method (maintained for backward compatibility)
    fn load_labels(&self) -> Result<()> {
        // Get platform-specific labels path
        let labels_path = self.get_labels_path();
        self.load_labels_from_path(&labels_path)
    }

    // Load labels from a specific path
    fn load_labels_from_path(&self, labels_path: &Path) -> Result<()> {
        // Only load labels if not already loaded
        if CLASS_LABELS.get().is_some() {
            return Ok(());
        }

        let mut file = File::open(labels_path)
            .with_context(|| format!("Failed to open labels file at {:?}", labels_path))?;

        let mut contents = String::new();
        file.read_to_string(&mut contents)
            .context("Failed to read labels file")?;

        let labels: Vec<String> = contents
            .lines()
            .map(|line| line.trim().to_string())
            .collect();

        CLASS_LABELS
            .set(labels)
            .map_err(|_| anyhow::anyhow!("Failed to set class labels"))?;

        Ok(())
    }
    // Remove the #[cfg(target_os = "android")] attribute
    pub fn init_android(&mut self) -> Result<()> {
        println!("Initializing model using embedded resources");

        // Embedded model files - make sure these paths are correct relative to model_manager.rs
        // If model_manager.rs is in src-tauri/src/, then use "../assets/model/..."
        const MODEL_BYTES: &[u8] = include_bytes!("../assets/model/mobilenet_v2.onnx");
        const LABELS_BYTES: &[u8] = include_bytes!("../assets/model/labels.txt");

        println!("Embedded model size: {} bytes", MODEL_BYTES.len());
        println!("Embedded labels size: {} bytes", LABELS_BYTES.len());

        // Try the direct model loading code
        let model = {
            use std::io::Cursor;

            // Create a cursor from the bytes
            let mut model_cursor = Cursor::new(MODEL_BYTES);

            // Load the model from the cursor
            tract_onnx::onnx()
                .model_for_read(&mut model_cursor)
                .with_context(|| "Failed to load ONNX model from embedded bytes")?
                .with_input_fact(
                    0,
                    InferenceFact::dt_shape(f32::datum_type(), tvec!(1, 3, 224, 224)),
                )
                .with_context(|| "Failed to set input shape")?
                .into_optimized()
                .with_context(|| "Failed to optimize model")?
                .into_runnable()
                .with_context(|| "Failed to convert model to runnable")?
        };

        // Load labels from bytes
        let labels_str = std::str::from_utf8(LABELS_BYTES)
            .context("Failed to convert labels bytes to string")?;

        let labels: Vec<String> = labels_str
            .lines()
            .map(|line| line.trim().to_string())
            .collect();

        println!("Parsed {} labels from embedded data", labels.len());

        // Set the labels
        if CLASS_LABELS.get().is_none() {
            CLASS_LABELS
                .set(labels)
                .map_err(|_| anyhow::anyhow!("Failed to set class labels"))?;
        }

        // Store the model
        self.model = Some(Arc::new(model));
        self.is_initialized = true;

        println!("Model initialization from embedded resources successful");
        Ok(())
    }
    pub fn recognize(&self, image_data: &[f32]) -> Result<Vec<(String, f32)>> {
        if !self.is_initialized || self.model.is_none() {
            return Err(ModelError::NotInitialized.into());
        }

        let start_time = Instant::now();
        let model = self.model.as_ref().unwrap();

        // Create the tensor from image data
        let input = tract_ndarray::Array4::from_shape_fn((1, 3, 224, 224), |(_, c, y, x)| {
            // Calculate the index in our flattened array
            // image_data is in HWC format (height, width, channels)
            let idx = (y * 224 + x) * 3 + c;
            image_data[idx as usize]
        });

        // Convert to tensor (without Arc)
        let input_tensor = input.into_tensor();

        // Run inference with the tensor directly
        let result = model
            .as_ref()
            .run(tvec!(input_tensor))
            .map_err(|e| ModelError::InferenceError(e.to_string()))?;

        // Get the output tensor
        let output = result[0]
            .to_array_view::<f32>()
            .map_err(|e| ModelError::InferenceError(e.to_string()))?;

        // The output is a 1D array of probabilities for each class
        // Extract the values and map them to class labels
        let mut class_scores: Vec<(String, f32)> = output
            .iter()
            .enumerate()
            .map(|(idx, &score)| {
                let label = CLASS_LABELS
                    .get()
                    .and_then(|labels| labels.get(idx).cloned())
                    .unwrap_or_else(|| format!("Unknown-{}", idx));

                (label, score)
            })
            .collect();

        // Sort by confidence score (descending)
        class_scores.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());

        // Take top 5 results
        let top_results = class_scores.into_iter().take(5).collect();

        let elapsed = start_time.elapsed();
        info!("Inference completed in {:.2?}", elapsed);

        Ok(top_results)
    }
}
