import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createDocument, updateDocumentStage } from '@/modules/documents/service';
import { DocumentUploadInitSchema } from '@/modules/validation/schemas';
import { formatErrorResponse, AppError } from '@/modules/errors/api-error';
import { storageProvider } from '@/modules/providers';
import { addDocumentToQueue } from '@/modules/processing/queue';
import { ProcessingStage, DocumentStatus } from '@prisma/client';

export async function GET() {
  try {
    const documents = await db.document.findMany({
      orderBy: { createdAt: 'desc' },
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
      console.log(`API: Matching active document found for "${fileName}" (ID: ${existingDoc.id}). Reusing process.`);
      return NextResponse.json({ document: existingDoc }, { status: 202 });
    }

    // 1. Create Document Database entry (status: UPLOADED, stage: UPLOADED)
    const document = await createDocument({
      fileName,
      mimeType,
      fileSizeBytes,
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
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
