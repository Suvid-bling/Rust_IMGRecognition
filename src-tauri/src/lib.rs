// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod image_processor;
mod model_manager;

use base64::{engine::general_purpose, Engine as _};
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

#[tauri::command]
async fn read_content_uri(app_handle: tauri::AppHandle, uri: String) -> Result<String, String> {
    println!("Reading content URI: {}", uri);

    #[cfg(target_os = "android")]
    {
        use jni::objects::{JObject, JString};
        use jni::JNIEnv;
        use std::ffi::c_void;
        use tauri::Manager;

        // Get the Android specific plugin
        let android = app_handle.state::<tauri::plugin::android::Android>();
        let activity = android.activity();

        // Get JNI env
        let vm = unsafe {
            jni::JavaVM::from_raw(android.vm_ptr() as *mut jni::sys::JavaVM)
                .map_err(|e| format!("Failed to get JavaVM: {}", e))?
        };

        let mut env = vm
            .attach_current_thread()
            .map_err(|e| format!("Failed to attach thread: {}", e))?;

        // Create a Java string from the content URI
        let uri_jstring = env
            .new_string(&uri)
            .map_err(|e| format!("Failed to create Java string: {}", e))?;

        // Get the ContentResolver
        let content_resolver_method = env
            .get_method_id(
                env.find_class("android/content/Context").unwrap(),
                "getContentResolver",
                "()Landroid/content/ContentResolver;",
            )
            .map_err(|e| format!("Failed to find getContentResolver method: {}", e))?;

        let content_resolver = env
            .call_method_unchecked(
                activity,
                content_resolver_method,
                jni::signature::ReturnType::Object,
                &[],
            )
            .map_err(|e| format!("Failed to call getContentResolver: {}", e))?;

        let content_resolver = content_resolver
            .l()
            .map_err(|e| format!("Failed to convert to JObject: {}", e))?;

        // Parse the URI
        let uri_class = env
            .find_class("android/net/Uri")
            .map_err(|e| format!("Failed to find Uri class: {}", e))?;

        let parse_method = env
            .get_static_method_id(uri_class, "parse", "(Ljava/lang/String;)Landroid/net/Uri;")
            .map_err(|e| format!("Failed to find parse method: {}", e))?;

        let uri_obj = env
            .call_static_method_unchecked(
                uri_class,
                parse_method,
                jni::signature::ReturnType::Object,
                &[jni::signature::Argument::Object(*uri_jstring)],
            )
            .map_err(|e| format!("Failed to call parse: {}", e))?;

        let uri_obj = uri_obj
            .l()
            .map_err(|e| format!("Failed to convert to JObject: {}", e))?;

        // Get input stream
        let content_resolver_class = env
            .find_class("android/content/ContentResolver")
            .map_err(|e| format!("Failed to find ContentResolver class: {}", e))?;

        let open_input_stream_method = env
            .get_method_id(
                content_resolver_class,
                "openInputStream",
                "(Landroid/net/Uri;)Ljava/io/InputStream;",
            )
            .map_err(|e| format!("Failed to find openInputStream method: {}", e))?;

        let input_stream = env
            .call_method_unchecked(
                content_resolver,
                open_input_stream_method,
                jni::signature::ReturnType::Object,
                &[jni::signature::Argument::Object(uri_obj)],
            )
            .map_err(|e| format!("Failed to call openInputStream: {}", e))?;

        let input_stream = input_stream
            .l()
            .map_err(|e| format!("Failed to convert to JObject: {}", e))?;

        if input_stream.is_null() {
            return Err("Failed to open input stream: null returned".to_string());
        }

        // Read all bytes from input stream
        let input_stream_class = env
            .find_class("java/io/InputStream")
            .map_err(|e| format!("Failed to find InputStream class: {}", e))?;

        let read_method = env
            .get_method_id(input_stream_class, "read", "([B)I")
            .map_err(|e| format!("Failed to find read method: {}", e))?;

        let mut buffer = Vec::new();
        let buffer_size = 8192;

        loop {
            let byte_array = env
                .new_byte_array(buffer_size as i32)
                .map_err(|e| format!("Failed to create byte array: {}", e))?;

            let read_count = env
                .call_method_unchecked(
                    input_stream,
                    read_method,
                    jni::signature::ReturnType::Primitive(jni::signature::Primitive::Int),
                    &[jni::signature::Argument::Object(JObject::from(byte_array))],
                )
                .map_err(|e| format!("Failed to call read: {}", e))?;

            let read_count = read_count
                .i()
                .map_err(|e| format!("Failed to convert to int: {}", e))?;

            if read_count <= 0 {
                break;
            }

            // Create a temporary Java byte array and copy it to our buffer
            let mut temp_buffer = vec![0i8; read_count as usize];
            env.get_byte_array_region(byte_array, 0, &mut temp_buffer)
                .map_err(|e| format!("Failed to get byte array region: {}", e))?;

            // Convert i8 to u8 (Java bytes are signed)
            let u8_buffer: Vec<u8> = temp_buffer.iter().map(|&b| b as u8).collect();
            buffer.extend_from_slice(&u8_buffer);
        }

        // Close the input stream
        let close_method = env
            .get_method_id(input_stream_class, "close", "()V")
            .map_err(|e| format!("Failed to find close method: {}", e))?;

        env.call_method_unchecked(
            input_stream,
            close_method,
            jni::signature::ReturnType::Primitive(jni::signature::Primitive::Void),
            &[],
        )
        .map_err(|e| format!("Failed to call close: {}", e))?;

        // Return base64 encoded data
        let base64_data = general_purpose::STANDARD.encode(&buffer);
        Ok(base64_data)
    }

    #[cfg(not(target_os = "android"))]
    {
        Err("Content URI handling is only supported on Android".to_string())
    }
}

#[tauri::command]
async fn init_model(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    println!("DEBUG POINT: init_model function called");

    let mut model_manager = state.model_manager.lock().await;

    // Print more debug info about the environment
    let platform_type = if cfg!(target_os = "android") {
        "Android (compile-time check)"
    } else if cfg!(any(target_os = "ios", target_os = "android")) {
        "Mobile device (compile-time check)"
    } else {
        "Desktop (compile-time check)"
    };

    println!("Platform detected as: {}", platform_type);

    // Check for "android" in the current binary path as a runtime check
    let is_runtime_android = std::env::current_exe()
        .map(|path| path.to_string_lossy().contains("android"))
        .unwrap_or(false);

    println!("Runtime Android check: {}", is_runtime_android);

    // For Android, try the byte-embedded approach first
    #[cfg(any(target_os = "android", feature = "mobile"))]
    {
        println!("Attempting Android/mobile initialization");
        match model_manager.init_android() {
            Ok(_) => {
                println!("Android direct initialization successful");
                return Ok("Model initialized successfully from embedded resources".to_string());
            }
            Err(e) => {
                println!("Android direct initialization failed: {}", e);
                println!("Falling back to standard initialization");
            }
        }
    }

    // If we're still here, try standard initialization for any platform
    println!("Attempting standard file-based initialization");
    model_manager.init().map_err(|e| {
        println!("Standard initialization failed: {}", e);
        e.to_string()
    })?;

    Ok("Model initialized successfully".to_string())
}

// #[cfg(target_os = "android")]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(debug_assertions)]
    {
        println!("Running in DEBUG mode");
    }
    // Initialize logger
    env_logger::init();
    println!("Starting TauriVision with tract backend");

    tauri::Builder::default()
        //.plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState {
            model_manager: Arc::new(Mutex::new(ModelManager::new())),
            image_processor: Arc::new(Mutex::new(ImageProcessor::new())),
        })
        .invoke_handler(tauri::generate_handler![
            init_model,
            recognize_image,
            recognize_image_data,
            read_content_uri,
        ])
        .run(tauri::generate_context!())
        .expect("Error while running tauri application");
}
