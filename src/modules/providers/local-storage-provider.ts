import { StorageProvider } from './types';
import path from 'path';
import fs from 'fs/promises';

export class LocalStorageProvider implements StorageProvider {
  private baseDir: string;

  constructor(baseDir: string = path.resolve('storage')) {
    this.baseDir = baseDir;
  }

  private resolvePath(storageKey: string): string {
    const resolvedPath = path.resolve(this.baseDir, storageKey);
    // Prevent directory traversal attacks
    if (!resolvedPath.startsWith(this.baseDir)) {
      throw new Error('Directory traversal attempt detected');
    }
    return resolvedPath;
  }

  async upload(file: Buffer, storageKey: string, _mimeType: string): Promise<void> {
    void _mimeType;
    const filePath = this.resolvePath(storageKey);
    const parentDir = path.dirname(filePath);
    
    // Ensure directory structure exists
    await fs.mkdir(parentDir, { recursive: true });
    await fs.writeFile(filePath, file);
  }

  async getObject(storageKey: string): Promise<Buffer> {
    const filePath = this.resolvePath(storageKey);
    try {
      return await fs.readFile(filePath);
    } catch (error) {
      throw new Error(`Failed to read file from storage key "${storageKey}": ${(error as Error).message}`);
    }
  }

  async delete(storageKey: string): Promise<void> {
    const filePath = this.resolvePath(storageKey);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // Ignore if file already deleted/does not exist
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async getSignedUploadUrl(storageKey: string, _mimeType: string): Promise<string> {
    void _mimeType;
    // For local mock, return a standard localhost API path or local schema
    return `http://localhost:3000/api/mock-upload?key=${encodeURIComponent(storageKey)}`;
  }
}
