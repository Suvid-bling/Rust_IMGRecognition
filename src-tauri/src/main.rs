// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod image_processor;
mod model_manager;

use image_processor::ImageProcessor;
use model_manager::ModelManager;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;

// Define app state for use with Tauri commands
pub struct AppState {
    model_manager: Arc<Mutex<ModelManager>>,
    image_processor: Arc<Mutex<ImageProcessor>>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct RecognitionResult {
    pub label: String,
    pub confidence: f32,
}

// Command handlers with tauri::command attribute
#[tauri::command]
async fn init_model(state: tauri::State<'_, AppState>) -> Result<String, String> {
    #[cfg(debug_assertions)]
    {
        println!("DEBUG POINT: init_model function called");
    }

    let mut model_manager = state.model_manager.lock().await;
    model_manager.init().map_err(|e| e.to_string())?;
    Ok("Model initialized successfully".to_string())
}

#[tauri::command]
async fn recognize_image(
    image_path: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<RecognitionResult>, String> {
    let image_processor = state.image_processor.lock().await;
    let image_data = image_processor
        .load_image(&image_path)
        .map_err(|e| e.to_string())?;

    let model_manager = state.model_manager.lock().await;
    let results = model_manager
        .recognize(&image_data)
        .map_err(|e| e.to_string())?;

    Ok(results
        .into_iter()
        .map(|(label, confidence)| RecognitionResult { label, confidence })
        .collect())
}

#[tauri::command]
async fn recognize_image_data(
    image_data: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<RecognitionResult>, String> {
    let image_processor = state.image_processor.lock().await;
    let processed_data = image_processor
        .process_base64_image(&image_data)
        .map_err(|e| e.to_string())?;

    let model_manager = state.model_manager.lock().await;
    let results = model_manager
        .recognize(&processed_data)
        .map_err(|e| e.to_string())?;

    Ok(results
        .into_iter()
        .map(|(label, confidence)| RecognitionResult { label, confidence })
        .collect())
}

fn main() {
    #[cfg(debug_assertions)]
    {
        println!("Running in DEBUG mode");
    }

    // Initialize logger
    env_logger::init();
    println!("Starting TauriVision with tract backend");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            model_manager: Arc::new(Mutex::new(ModelManager::new())),
            image_processor: Arc::new(Mutex::new(ImageProcessor::new())),
        })
        .invoke_handler(tauri::generate_handler![
            init_model,
            recognize_image,
            recognize_image_data,
        ])
        .run(tauri::generate_context!())
        .expect("Error while running tauri application");
}
