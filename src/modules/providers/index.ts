import { LocalStorageProvider } from './local-storage-provider';
import { PDFExtractionProvider } from './pdf-extraction-provider';
import { OCRProvider } from './ocr-provider';
import { GeminiSummarizationProvider } from './gemini-summarization-provider';

export const storageProvider = new LocalStorageProvider();
export const pdfExtractionProvider = new PDFExtractionProvider(storageProvider);
export const ocrProvider = new OCRProvider(storageProvider);
export const summarizationProvider = new GeminiSummarizationProvider();
