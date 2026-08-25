import { StorageProvider } from './types';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

export class LocalStorageProvider implements StorageProvider {
  private baseDir: string;

  constructor(baseDir?: string) {
    // Detect any serverless container environment (Vercel, Netlify, AWS Lambda, Linux containers)
    const isServerless =
      Boolean(process.env.NETLIFY) ||
      Boolean(process.env.VERCEL) ||
      process.env.NODE_ENV === 'production' ||
      process.platform === 'linux';
    
    // On Serverless, standard relative directories are read-only. Always use os.tmpdir() (/tmp)
    const defaultDir = isServerless
      ? path.join(os.tmpdir(), 'docus_storage')
      : path.resolve('storage');

    this.baseDir = baseDir || defaultDir;
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
    
    // Ensure directory structure exists (in writable /tmp for serverless)
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
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async getSignedUploadUrl(storageKey: string, _mimeType: string): Promise<string> {
    void _mimeType;
    return `http://localhost:3000/api/mock-upload?key=${encodeURIComponent(storageKey)}`;
  }
}
