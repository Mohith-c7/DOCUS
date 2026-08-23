import { z } from 'zod';
import { FileType, SummaryLength } from '@prisma/client';

export const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp'
] as const;

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export const DocumentUploadInitSchema = z.object({
  fileName: z.string().min(1, 'File name is required').max(255, 'File name is too long'),
  mimeType: z.enum(SUPPORTED_MIME_TYPES, {
    message: 'Unsupported file type. Only PDF and images (PNG, JPEG, WebP) are allowed.'
  }),
  fileSizeBytes: z
    .number()
    .int()
    .positive('File size must be greater than zero')
    .max(MAX_FILE_SIZE_BYTES, 'File size exceeds the allowed 50MB limit')
});

export const SummaryRequestSchema = z.object({
  length: z.nativeEnum(SummaryLength, {
    message: 'Invalid summary length configuration.'
  })
});

export const StructuredSummarySchema = z.object({
  title: z.string().min(1, 'Title cannot be empty'),
  summary: z.string().min(1, 'Summary cannot be empty'),
  keyPoints: z.array(z.string()).min(1, 'At least one key point must be generated'),
  mainIdeas: z.array(z.string()).min(1, 'At least one main idea must be generated')
});

export type DocumentUploadInitInput = z.infer<typeof DocumentUploadInitSchema>;
export type SummaryRequestInput = z.infer<typeof SummaryRequestSchema>;
export type StructuredSummary = z.infer<typeof StructuredSummarySchema>;

export function getFileTypeFromMime(mimeType: string): FileType {
  if (mimeType === 'application/pdf') {
    return FileType.PDF;
  }
  if (mimeType.startsWith('image/')) {
    return FileType.IMAGE;
  }
  throw new Error(`Unsupported MIME type to FileType mapping: ${mimeType}`);
}
