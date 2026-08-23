import { LocalStorageProvider } from './local-storage-provider';
import { SupabaseStorageProvider } from './supabase-storage-provider';
import { PDFExtractionProvider } from './pdf-extraction-provider';
import { OCRProvider } from './ocr-provider';
import { GeminiSummarizationProvider } from './gemini-summarization-provider';

export const storageProvider =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? new SupabaseStorageProvider()
    : new LocalStorageProvider();

export const pdfExtractionProvider = new PDFExtractionProvider(storageProvider);
export const ocrProvider = new OCRProvider(storageProvider);
export const summarizationProvider = new GeminiSummarizationProvider();
