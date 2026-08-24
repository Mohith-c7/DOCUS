import { db } from '../../lib/db';
import { Document, DocumentStatus, ProcessingStage } from '@prisma/client';
import { AppError } from '../errors/api-error';
import { validateStatusTransition, validateStageTransition } from './transitions';
import { getFileTypeFromMime } from '../validation/schemas';

export interface CreateDocumentInput {
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  userId?: string;
  anonymousSessionId?: string;
  ipAddress?: string;
}

export async function createDocument(input: CreateDocumentInput): Promise<Document> {
  const fileType = getFileTypeFromMime(input.mimeType);
  const storageKey = `uploads/${crypto.randomUUID()}-${input.fileName}`;

  let validUserId: string | null = null;
  if (input.userId) {
    try {
      const userExists = await db.user.findUnique({ where: { id: input.userId } });
      if (userExists) validUserId = input.userId;
    } catch {
      validUserId = null;
    }
  }

  return db.document.create({
    data: {
      originalFileName: input.fileName,
      fileType,
      mimeType: input.mimeType,
      fileSizeBytes: input.fileSizeBytes,
      storageKey,
      userId: validUserId,
      anonymousSessionId: input.anonymousSessionId || null,
      ipAddress: input.ipAddress || null,
      status: DocumentStatus.UPLOADED,
      currentStage: ProcessingStage.UPLOADED,
    },
  });
}

export async function getDocumentById(id: string): Promise<Document> {
  const doc = await db.document.findUnique({
    where: { id },
  });

  if (!doc) {
    throw new AppError('DOCUMENT_NOT_FOUND', 404, `Document with ID ${id} not found`);
  }

  return doc;
}

export async function updateDocumentStage(
  id: string,
  newStage: ProcessingStage,
  extraData?: {
    extractionMethod?: Document['extractionMethod'];
    completedAt?: Date;
    failedAt?: Date;
  }
): Promise<Document> {
  return db.$transaction(async (tx) => {
    const doc = await tx.document.findUnique({
      where: { id },
    });

    if (!doc) {
      throw new AppError('DOCUMENT_NOT_FOUND', 404, `Document with ID ${id} not found`);
    }

    // Determine target DocumentStatus from the new ProcessingStage
    let targetStatus: DocumentStatus;
    if (newStage === ProcessingStage.COMPLETED) {
      targetStatus = DocumentStatus.COMPLETED;
    } else if (newStage === ProcessingStage.FAILED) {
      targetStatus = DocumentStatus.FAILED;
    } else if (newStage === ProcessingStage.UPLOADED) {
      targetStatus = DocumentStatus.UPLOADED;
    } else {
      targetStatus = DocumentStatus.PROCESSING;
    }

    // Run transition guards
    validateStatusTransition(doc.status, targetStatus);
    validateStageTransition(doc.currentStage, newStage);

    const updatePayload: Partial<Document> = {
      currentStage: newStage,
      status: targetStatus,
    };

    if (extraData?.extractionMethod !== undefined) {
      updatePayload.extractionMethod = extraData.extractionMethod;
    }

    if (targetStatus === DocumentStatus.COMPLETED) {
      updatePayload.completedAt = extraData?.completedAt || new Date();
    } else if (targetStatus === DocumentStatus.FAILED) {
      updatePayload.failedAt = extraData?.failedAt || new Date();
    }

    return tx.document.update({
      where: { id },
      data: updatePayload,
    });
  });
}
