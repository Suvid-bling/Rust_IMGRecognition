use anyhow::{Context, Result};
use base64::{engine::general_purpose, Engine as _};
use image::{DynamicImage, GenericImageView, ImageBuffer, Rgba};
use std::io::Cursor;

pub struct ImageProcessor {
    target_width: u32,
    target_height: u32,
}

impl ImageProcessor {
    pub fn new() -> Self {
        // Default target size for the model input (mobilenet expects 224x224)
        Self {
            target_width: 224,
            target_height: 224,
        }
    }

    // Load an image from a file path
    pub fn load_image(&self, path: &str) -> Result<Vec<f32>> {
        let img = image::open(path)
            .with_context(|| format!("Failed to open image from path: {}", path))?;
        self.preprocess_image(img)
    }

    // Process base64-encoded image data
    pub fn process_base64_image(&self, base64_data: &str) -> Result<Vec<f32>> {
        // Strip potential data URL prefix
        let base64_str = if base64_data.contains("base64,") {
            base64_data.split("base64,").nth(1).unwrap_or(base64_data)
        } else {
            base64_data
        };

        // Decode base64 data
        let image_data = general_purpose::STANDARD
            .decode(base64_str)
            .context("Failed to decode base64 image data")?;

        // Convert to image
        let img = image::load_from_memory(&image_data)
            .context("Failed to load image from decoded data")?;

        self.preprocess_image(img)
    }

    // Process camera frame data
    pub fn process_camera_frame(
        &self,
        width: u32,
        height: u32,
        rgba_data: Vec<u8>,
    ) -> Result<Vec<f32>> {
        // Create an image buffer from raw RGBA data
        let img_buffer: ImageBuffer<Rgba<u8>, Vec<u8>> =
            ImageBuffer::from_raw(width, height, rgba_data)
                .context("Failed to create image buffer from camera frame")?;

        // Convert to DynamicImage for preprocessing
        let img = DynamicImage::ImageRgba8(img_buffer);

        self.preprocess_image(img)
    }

    // Preprocess image for model input
    fn preprocess_image(&self, img: DynamicImage) -> Result<Vec<f32>> {
        // Resize image to target dimensions
        let resized = img.resize_exact(
            self.target_width,
            self.target_height,
            image::imageops::FilterType::Triangle,
        );

        // Convert to RGB
        let rgb_img = resized.to_rgb8();

        // For tract, we need to normalize pixel values typically to [-1, 1] or [0, 1]
        // and store in HWC format (height, width, channels)
        let mut normalized_data =
            Vec::with_capacity((self.target_width * self.target_height * 3) as usize);

        for pixel in rgb_img.pixels() {
            // Normalize to [0, 1] range
            normalized_data.push(pixel[0] as f32 / 255.0);
            normalized_data.push(pixel[1] as f32 / 255.0);
            normalized_data.push(pixel[2] as f32 / 255.0);
        }

        Ok(normalized_data)
    }

    // Set custom target dimensions if needed
    pub fn set_target_dimensions(&mut self, width: u32, height: u32) {
        self.target_width = width;
        self.target_height = height;
    }
}
