export type ErrorCode =
  // Validation
  | 'VALIDATION_ERROR'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'EMPTY_FILE'
  | 'INVALID_FILE'
  // Document
  | 'DOCUMENT_NOT_FOUND'
  | 'DOCUMENT_NOT_READY'
  | 'DOCUMENT_PROCESSING_FAILED'
  | 'NOT_FOUND'
  | 'COLLECTION_NOT_FOUND'
  // Processing
  | 'EXTRACTION_FAILED'
  | 'OCR_FAILED'
  | 'NO_EXTRACTABLE_CONTENT'
  | 'SUMMARIZATION_FAILED'
  | 'INVALID_SUMMARY_OUTPUT'
  // Infrastructure
  | 'STORAGE_ERROR'
  | 'DATABASE_ERROR'
  | 'PROCESSING_UNAVAILABLE'
  | 'AI_PROVIDER_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export interface ValidationErrorDetail {
  field: string;
  message: string;
}

export function mapZodIssues(issues: Array<{ path: Array<string | number | symbol>; message: string }>): ValidationErrorDetail[] {
  return issues.map((i) => ({
    field: i.path.map((p) => String(p)).join('.') || 'root',
    message: i.message,
  }));
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: ValidationErrorDetail[];

  constructor(code: ErrorCode, statusCode: number, message: string, details?: ValidationErrorDetail[]) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function formatErrorResponse(error: unknown) {
  if (error instanceof AppError) {
    return {
      status: error.statusCode,
      body: {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      },
    };
  }

  const rawMessage = error instanceof Error ? error.message : String(error);
  return {
    status: 500,
    body: {
      error: {
        code: 'INTERNAL_ERROR' as ErrorCode,
        message: rawMessage || 'An unexpected error occurred.',
      },
    },
  };
}
