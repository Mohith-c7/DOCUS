import { DocumentExtractionProvider, ExtractionResult, StorageProvider } from './types';

// Import pdf-parse core directly to bypass pdf-parse's index.js debug test file read bug (!module.parent) in Next.js bundled environments
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdf = require('pdf-parse/lib/pdf-parse.js');

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
