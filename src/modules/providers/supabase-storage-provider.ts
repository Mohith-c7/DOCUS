import { StorageProvider } from './types';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export class SupabaseStorageProvider implements StorageProvider {
  private supabase: SupabaseClient;
  private bucket: string;

  constructor() {
    const url =
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      'https://cvccxxwkjphryzkmbcjv.supabase.co';
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      'sb_publishable_aumvKd8xGotyq1jWUowYgA_xQ3e2L76';

    this.supabase = createClient(url, key, {
      auth: {
        persistSession: false,
      },
    });
    this.bucket = process.env.SUPABASE_STORAGE_BUCKET || 'docus';
  }

  async upload(file: Buffer, storageKey: string, mimeType: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(this.bucket)
      .upload(storageKey, file, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      throw new Error(`Supabase storage upload error for key "${storageKey}": ${error.message}`);
    }
  }

  async getObject(storageKey: string): Promise<Buffer> {
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .download(storageKey);

    if (error) {
      throw new Error(`Supabase storage download error for key "${storageKey}": ${error.message}`);
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async delete(storageKey: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(this.bucket)
      .remove([storageKey]);

    if (error) {
      throw new Error(`Supabase storage delete error for key "${storageKey}": ${error.message}`);
    }
  }

  async getSignedUploadUrl(storageKey: string, _mimeType: string): Promise<string> {
    void _mimeType;
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUploadUrl(storageKey);

    if (error) {
      throw new Error(`Supabase storage signed URL generation failed for key "${storageKey}": ${error.message}`);
    }

    return data.signedUrl;
  }
}
