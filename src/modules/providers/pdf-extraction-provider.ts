import { DocumentExtractionProvider, ExtractionResult, StorageProvider } from './types';
import pdf from 'pdf-parse';

export class PDFExtractionProvider implements DocumentExtractionProvider {
  private storage: StorageProvider;

  constructor(storage: StorageProvider) {
    this.storage = storage;
  }

  async extract(storageKey: string): Promise<ExtractionResult> {
    const buffer = await this.storage.getObject(storageKey);
    try {
      const data = await pdf(buffer);
      
      return {
        text: data.text || '',
        pageCount: data.numpages || 0,
        characterCount: (data.text || '').length,
      };
    } catch (error) {
      throw new Error(`PDF extraction failed: ${(error as Error).message}`);
    }
  }
}
