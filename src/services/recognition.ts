import { invoke } from '@tauri-apps/api/core';

export interface RecognitionResult {
  label: string;
  confidence: number;
}

export class RecognitionService {
  private static instance: RecognitionService;
  private modelInitialized: boolean = false;

  private constructor() {}

  public static getInstance(): RecognitionService {
    if (!RecognitionService.instance) {
      RecognitionService.instance = new RecognitionService();
    }
    return RecognitionService.instance;
  }

  /**
   * Initialize the model
   */
  public async initModel(): Promise<void> {
    if (this.modelInitialized) {
      return;
    }

    try {
      await invoke('init_model');
      this.modelInitialized = true;
    } catch (error) {
      console.error('Failed to initialize model:', error);
      throw error;
    }
  }

  /**
   * Recognize an image from its file path
   * @param imagePath Path to the image file
   * @returns Array of recognition results
   */
  public async recognizeImage(imagePath: string): Promise<RecognitionResult[]> {
    if (!this.modelInitialized) {
      await this.initModel();
    }

    try {
      const results = await invoke<RecognitionResult[]>('recognize_image', {
        imagePath,
      });
      return results;
    } catch (error) {
      console.error('Recognition failed:', error);
      throw error;
    }
  }

  /**
   * Recognize an image from its base64 encoded data
   * @param imageData Base64 encoded image data
   * @returns Array of recognition results
   */
  public async recognizeImageData(imageData: string): Promise<RecognitionResult[]> {
    if (!this.modelInitialized) {
      await this.initModel();
    }

    try {
      const results = await invoke<RecognitionResult[]>('recognize_image_data', {
        imageData,
      });
      return results;
    } catch (error) {
      console.error('Recognition failed:', error);
      throw error;
    }
  }
}

export default RecognitionService.getInstance();