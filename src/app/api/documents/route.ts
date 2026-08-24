import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createDocument, updateDocumentStage } from '@/modules/documents/service';
import { DocumentUploadInitSchema } from '@/modules/validation/schemas';
import { formatErrorResponse, AppError } from '@/modules/errors/api-error';
import { storageProvider } from '@/modules/providers';
import { addDocumentToQueue } from '@/modules/processing/queue';
import { ProcessingStage, DocumentStatus, Prisma } from '@prisma/client';

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
      // Auto device IP fallback
      whereClause.ipAddress = clientIp;
    }

    // Search filter on file name
    if (search) {
      whereClause.originalFileName = { contains: search, mode: 'insensitive' };
    }

    // Status filter
    if (status) {
      whereClause.status = status as DocumentStatus;
    }

    // Collection filter — join through DocumentCollection
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
      take: 100, // safety cap
    });
    return NextResponse.json({ documents });
  } catch (error) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const userId = (formData.get('userId') as string) || undefined;
    const anonymousSessionId = (formData.get('anonymousSessionId') as string) || undefined;

    if (!file) {
      throw new AppError('VALIDATION_ERROR', 400, 'No file was provided in the upload request.');
    }

    const fileName = file.name;
    const mimeType = file.type;
    const fileSizeBytes = file.size;

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

    // Idempotency / Cache Check: Re-use matching document if uploaded recently and not failed (unless it holds mock summaries)
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

    // 1. Create Document Database entry (status: UPLOADED, stage: UPLOADED)
    const document = await createDocument({
      fileName,
      mimeType,
      fileSizeBytes,
      userId,
      anonymousSessionId,
      ipAddress: clientIp,
    });

    // 2. Upload Binary file to Storage Provider
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    try {
      await storageProvider.upload(buffer, document.storageKey, document.mimeType);
    } catch (storageError) {
      // Clean up document state on storage write failure
      await updateDocumentStage(document.id, ProcessingStage.FAILED);
      throw new AppError(
        'STORAGE_ERROR',
        500,
        `Storage upload failed: ${(storageError as Error).message}`
      );
    }

    // 3. Initiate native processing pipeline asynchronously in the background via BullMQ persistent queue
    await addDocumentToQueue(document.id);

    // 4. Return 202 Accepted representing accepted for background processing
    return NextResponse.json({ document }, { status: 202 });
  } catch (error) {
    console.error('API Error in POST /api/documents:', error);
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
