import { z } from 'zod';
import { FileType, SummaryLength } from '@prisma/client';

export const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp'
] as const;

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export const SUMMARY_TEMPLATES = [
  'general',
  'legal',
  'medical',
  'academic',
  'technical',
  'financial',
] as const;

export const SUPPORTED_LANGUAGES = [
  'en',   // English
  'es',   // Spanish
  'fr',   // French
  'de',   // German
  'hi',   // Hindi
  'pt',   // Portuguese
] as const;

export type SummaryTemplate = typeof SUMMARY_TEMPLATES[number];
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

export const TEMPLATE_LABELS: Record<SummaryTemplate, string> = {
  general: 'General',
  legal: 'Legal',
  medical: 'Medical',
  academic: 'Academic',
  technical: 'Technical',
  financial: 'Financial',
};

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: '🇺🇸 English',
  es: '🇪🇸 Spanish',
  fr: '🇫🇷 French',
  de: '🇩🇪 German',
  hi: '🇮🇳 Hindi',
  pt: '🇧🇷 Portuguese',
};

export const TEMPLATE_SYSTEM_PROMPTS: Record<SummaryTemplate, string> = {
  general: '',
  legal: `Focus on: legal obligations, parties involved, key clauses, risks, deadlines, and liability terms. Use precise legal language. Highlight any unusual or potentially unfavorable terms.`,
  medical: `Focus on: diagnosis, treatment plans, medications, dosages, contraindications, clinical findings, and patient outcomes. Use medical terminology appropriately. Note any critical health information.`,
  academic: `Focus on: research objectives, methodology, key findings, conclusions, limitations, and academic contributions. Preserve technical terminology. Note citations of importance.`,
  technical: `Focus on: system architecture, technical specifications, APIs, data flows, algorithms, and implementation details. Use precise technical language. Highlight dependencies and constraints.`,
  financial: `Focus on: revenue, costs, profit/loss, key financial metrics, risks, forecasts, and investment implications. Use financial terminology. Highlight any red flags or notable trends.`,
};

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
  }),
  template: z.enum(SUMMARY_TEMPLATES).optional().default('general'),
  language: z.enum(SUPPORTED_LANGUAGES).optional().default('en'),
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

export function normalizeMimeType(fileName: string, rawMimeType?: string): string {
  const mime = (rawMimeType || '').toLowerCase().trim();
  if (mime === 'application/pdf' || mime === 'application/x-pdf') return 'application/pdf';
  if (mime === 'image/png' || mime === 'image/x-png') return 'image/png';
  if (mime === 'image/jpeg' || mime === 'image/jpg' || mime === 'image/pjpeg') return 'image/jpeg';
  if (mime === 'image/webp') return 'image/webp';

  const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';

  return mime || 'application/pdf';
}

export function getFileTypeFromMime(mimeType: string): FileType {
  if (mimeType === 'application/pdf') {
    return FileType.PDF;
  }
  if (mimeType.startsWith('image/')) {
    return FileType.IMAGE;
  }
  return FileType.PDF;
}
