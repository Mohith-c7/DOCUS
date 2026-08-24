import { StorageProvider } from './types';
import { LocalStorageProvider } from './local-storage-provider';
import { SupabaseStorageProvider } from './supabase-storage-provider';
import { PDFExtractionProvider } from './pdf-extraction-provider';
import { OCRProvider } from './ocr-provider';
import { GeminiSummarizationProvider } from './gemini-summarization-provider';

class ResilientStorageProvider implements StorageProvider {
  private primary: StorageProvider;
  private fallback: StorageProvider;

  constructor() {
    this.primary = new SupabaseStorageProvider();
    this.fallback = new LocalStorageProvider();
  }

  async upload(file: Buffer, storageKey: string, mimeType: string): Promise<void> {
    try {
      await this.primary.upload(file, storageKey, mimeType);
    } catch (primaryErr) {
      console.warn(`[Storage] Primary storage upload failed (${(primaryErr as Error).message}). Routing to fallback storage...`);
      await this.fallback.upload(file, storageKey, mimeType);
    }
  }

  async getObject(storageKey: string): Promise<Buffer> {
    try {
      return await this.primary.getObject(storageKey);
    } catch {
      return await this.fallback.getObject(storageKey);
    }
  }

  async delete(storageKey: string): Promise<void> {
    try {
      await this.primary.delete(storageKey);
    } catch {
      await this.fallback.delete(storageKey);
    }
  }

  async getSignedUploadUrl(storageKey: string, mimeType: string): Promise<string> {
    try {
      return await this.primary.getSignedUploadUrl(storageKey, mimeType);
    } catch {
      return await this.fallback.getSignedUploadUrl(storageKey, mimeType);
    }
  }
}

export const storageProvider: StorageProvider = new ResilientStorageProvider();
export const pdfExtractionProvider = new PDFExtractionProvider(storageProvider);
export const ocrProvider = new OCRProvider(storageProvider);
export const getSummarizationProvider = () => new GeminiSummarizationProvider();
