import { DocumentStatus, ProcessingStage } from '@prisma/client';
import { AppError } from '../errors/api-error';

const ALLOWED_STATUS_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  UPLOADED: ['PROCESSING', 'FAILED'],
  PROCESSING: ['COMPLETED', 'FAILED'],
  COMPLETED: ['UPLOADED', 'PROCESSING'], // Allow re-processing / resetting
  FAILED: ['PROCESSING', 'UPLOADED'], // Allow retry / reset
};

const ALLOWED_STAGE_TRANSITIONS: Record<ProcessingStage, ProcessingStage[]> = {
  UPLOADING: ['UPLOADED', 'FAILED'],
  UPLOADED: ['EXTRACTING', 'FAILED'],
  EXTRACTING: ['OCR_PROCESSING', 'NORMALIZING', 'FAILED'],
  OCR_PROCESSING: ['NORMALIZING', 'FAILED'],
  NORMALIZING: ['SUMMARIZING', 'FAILED'],
  SUMMARIZING: ['COMPLETED', 'FAILED'],
  COMPLETED: ['UPLOADED', 'EXTRACTING'], // Allow re-processing reset
  FAILED: ['EXTRACTING', 'OCR_PROCESSING', 'UPLOADED'], // Allow retry from different entry points
};

/**
 * Validates transition of DocumentStatus. Throws AppError if transition is invalid.
 */
export function validateStatusTransition(current: DocumentStatus, next: DocumentStatus): void {
  if (current === next) return; // No change is fine

  const allowed = ALLOWED_STATUS_TRANSITIONS[current];
  if (!allowed.includes(next)) {
    throw new AppError(
      'VALIDATION_ERROR',
      400,
      `Invalid document status transition from ${current} to ${next}`
    );
  }
}

/**
 * Validates transition of ProcessingStage. Throws AppError if transition is invalid.
 */
export function validateStageTransition(current: ProcessingStage, next: ProcessingStage): void {
  if (current === next) return; // No change is fine

  const allowed = ALLOWED_STAGE_TRANSITIONS[current];
  if (!allowed.includes(next)) {
    throw new AppError(
      'VALIDATION_ERROR',
      400,
      `Invalid processing stage transition from ${current} to ${next}`
    );
  }
}
