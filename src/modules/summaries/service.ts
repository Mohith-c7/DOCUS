import { db } from '../../lib/db';
import { Summary, SummaryLength } from '@prisma/client';
import { AppError } from '../errors/api-error';

export interface CreateSummaryInput {
  documentId: string;
  length: SummaryLength;
  title: string;
  summary: string;
  keyPoints: string[];
  mainIdeas: string[];
  processingVersion: string;
}

export async function createSummary(input: CreateSummaryInput): Promise<Summary> {
  // Check if document exists first
  const doc = await db.document.findUnique({
    where: { id: input.documentId },
  });

  if (!doc) {
    throw new AppError('DOCUMENT_NOT_FOUND', 404, `Document with ID ${input.documentId} not found`);
  }

  try {
    return await db.summary.create({
      data: {
        documentId: input.documentId,
        length: input.length,
        title: input.title,
        summary: input.summary,
        keyPoints: input.keyPoints,
        mainIdeas: input.mainIdeas,
        processingVersion: input.processingVersion,
      },
    });
  } catch (error) {
    // Check for unique constraint violation (documentId, length)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      throw new AppError(
        'VALIDATION_ERROR',
        409,
        `A summary of length ${input.length} already exists for this document`
      );
    }
    throw error;
  }
}

export async function getSummariesByDocumentId(documentId: string): Promise<Summary[]> {
  const doc = await db.document.findUnique({
    where: { id: documentId },
  });

  if (!doc) {
    throw new AppError('DOCUMENT_NOT_FOUND', 404, `Document with ID ${documentId} not found`);
  }

  return db.summary.findMany({
    where: { documentId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getSummaryById(id: string): Promise<Summary> {
  const summary = await db.summary.findUnique({
    where: { id },
  });

  if (!summary) {
    throw new AppError('VALIDATION_ERROR', 404, `Summary with ID ${id} not found`);
  }

  return summary;
}
