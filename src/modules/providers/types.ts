export interface StorageProvider {
  upload(file: Buffer, storageKey: string, mimeType: string): Promise<void>;
  getObject(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
  getSignedUploadUrl(storageKey: string, mimeType: string): Promise<string>;
}

export interface ExtractionResult {
  text: string;
  pageCount?: number;
  characterCount: number;
}

export interface DocumentExtractionProvider {
  extract(storageKey: string): Promise<ExtractionResult>;
}

export interface OCRProvider {
  extract(storageKey: string): Promise<ExtractionResult>;
}

export interface SummaryResult {
  title: string;
  summary: string;
  keyPoints: string[];
  mainIdeas: string[];
}

export interface SummarizationProvider {
  summarize(content: string, length: 'SHORT' | 'MEDIUM' | 'LONG'): Promise<SummaryResult>;
}
