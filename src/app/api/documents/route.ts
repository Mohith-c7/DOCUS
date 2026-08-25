export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createDocument, updateDocumentStage } from '@/modules/documents/service';
import { DocumentUploadInitSchema, SummaryTemplate, SupportedLanguage, normalizeMimeType } from '@/modules/validation/schemas';
import { formatErrorResponse, AppError } from '@/modules/errors/api-error';
import { storageProvider } from '@/modules/providers';
import { addDocumentToQueue } from '@/modules/processing/queue';
import { ProcessingStage, DocumentStatus, Prisma, SummaryLength } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const anonymousSessionId = searchParams.get('anonymousSessionId');
    const search = searchParams.get('search') || '';
    const collectionId = searchParams.get('collectionId');
    const status = searchParams.get('status');

    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip') || undefined;

    const whereClause: Prisma.DocumentWhereInput = {};
    if (userId) {
      whereClause.userId = userId;
    } else if (anonymousSessionId) {
      whereClause.anonymousSessionId = anonymousSessionId;
    } else if (clientIp) {
      whereClause.ipAddress = clientIp;
    }

    if (search) {
      whereClause.originalFileName = { contains: search, mode: 'insensitive' };
    }

    if (status) {
      whereClause.status = status as DocumentStatus;
    }

    if (collectionId) {
      whereClause.collections = {
        some: { collectionId },
      };
    }

    const documents = await db.document.findMany({
      where: whereClause,
      include: {
        summaries: { select: { length: true, title: true, createdAt: true } },
        collections: { select: { collectionId: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return NextResponse.json({ documents });
  } catch (error) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let fileName = '';
    let rawMimeType = '';
    let fileSizeBytes = 0;
    let userId: string | undefined;
    let anonymousSessionId: string | undefined;
    let template: SummaryTemplate = 'general';
    let language: SupportedLanguage = 'en';
    let length: SummaryLength = SummaryLength.MEDIUM;
    let buffer: Buffer;

    if (contentType.includes('application/json')) {
      const jsonBody = await request.json();
      fileName = jsonBody.fileName || '';
      rawMimeType = jsonBody.mimeType || 'application/pdf';
      fileSizeBytes = jsonBody.fileSizeBytes || 0;
      userId = jsonBody.userId || undefined;
      anonymousSessionId = jsonBody.anonymousSessionId || undefined;
      template = (jsonBody.template as SummaryTemplate) || 'general';
      language = (jsonBody.language as SupportedLanguage) || 'en';
      length = (jsonBody.length as SummaryLength) || SummaryLength.MEDIUM;

      if (!jsonBody.fileData) {
        throw new AppError('VALIDATION_ERROR', 400, 'No base64 fileData provided in JSON request.');
      }

      // Strips data URL prefix if present (e.g. data:application/pdf;base64,...)
      const base64Clean = jsonBody.fileData.replace(/^data:[^;]+;base64,/, '');
      buffer = Buffer.from(base64Clean, 'base64');
      if (fileSizeBytes === 0) fileSizeBytes = buffer.length;
    } else {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      userId = (formData.get('userId') as string) || undefined;
      anonymousSessionId = (formData.get('anonymousSessionId') as string) || undefined;
      template = (formData.get('template') as SummaryTemplate) || 'general';
      language = (formData.get('language') as SupportedLanguage) || 'en';
      length = (formData.get('length') as SummaryLength) || SummaryLength.MEDIUM;

      if (!file) {
        throw new AppError('VALIDATION_ERROR', 400, 'No file was provided in the upload request.');
      }

      fileName = file.name;
      rawMimeType = file.type;
      fileSizeBytes = file.size;

      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }

    const mimeType = normalizeMimeType(fileName, rawMimeType);

    // Server-side validation using Zod
    const validationResult = DocumentUploadInitSchema.safeParse({
      fileName,
      mimeType,
      fileSizeBytes,
    });

    if (!validationResult.success) {
      const details = validationResult.error.issues.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      throw new AppError('VALIDATION_ERROR', 400, 'Invalid file upload parameters.', details);
    }

    // Idempotency / Cache Check: Re-use matching document if uploaded recently and not failed
    const existingDoc = await db.document.findFirst({
      where: {
        originalFileName: fileName,
        fileSizeBytes,
        status: {
          in: [DocumentStatus.UPLOADED, DocumentStatus.PROCESSING, DocumentStatus.COMPLETED],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (existingDoc) {
      const existingSummaries = await db.summary.findMany({
        where: { documentId: existingDoc.id },
      });
      const hasMockSummary = existingSummaries.some((s) => s.summary.includes('[Mock Summary'));

      if (!hasMockSummary && existingDoc.status === DocumentStatus.COMPLETED) {
        console.log(`API: Matching active document found for "${fileName}" (ID: ${existingDoc.id}). Reusing process.`);
        return NextResponse.json({ document: existingDoc }, { status: 202 });
      }

      if (hasMockSummary) {
        console.log(`API: Document "${fileName}" (ID: ${existingDoc.id}) has mock summaries. Resetting stage and re-queuing.`);
        await db.summary.deleteMany({ where: { documentId: existingDoc.id } });
        const updatedDoc = await db.document.update({
          where: { id: existingDoc.id },
          data: {
            status: DocumentStatus.UPLOADED,
            currentStage: ProcessingStage.UPLOADED,
            userId: userId || existingDoc.userId,
            anonymousSessionId: anonymousSessionId || existingDoc.anonymousSessionId,
          },
        });
        await addDocumentToQueue(existingDoc.id);
        return NextResponse.json({ document: updatedDoc }, { status: 202 });
      }
    }

    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip') || undefined;

    // 1. Create Document Database entry
    const document = await createDocument({
      fileName,
      mimeType,
      fileSizeBytes,
      userId,
      anonymousSessionId,
      ipAddress: clientIp,
    });

    // 2. Upload Binary file to Storage Provider
    try {
      await storageProvider.upload(buffer, document.storageKey, document.mimeType);
    } catch (storageError) {
      console.error(`Storage provider upload failed for document ${document.id}:`, storageError);
      await updateDocumentStage(document.id, ProcessingStage.FAILED).catch(() => {});
      throw new AppError(
        'STORAGE_ERROR',
        500,
        `Storage write error: ${(storageError as Error).message}`
      );
    }

    // 3. Initiate native processing pipeline asynchronously in non-blocking background queue
    try {
      await addDocumentToQueue(document.id, { length, template, language });
    } catch (queueErr) {
      console.warn(`Queue scheduling warning for document ${document.id}:`, queueErr);
    }

    // 4. Return 202 Accepted
    return NextResponse.json({ document }, { status: 202 });
  } catch (error) {
    console.error('API Error in POST /api/documents:', error);
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
