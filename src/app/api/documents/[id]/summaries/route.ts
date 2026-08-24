import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createSummary, getSummariesByDocumentId } from '@/modules/summaries/service';
import { getDocumentById } from '@/modules/documents/service';
import { SummaryRequestSchema } from '@/modules/validation/schemas';
import { formatErrorResponse, AppError } from '@/modules/errors/api-error';
import { summarizeDocumentContent } from '@/modules/processing/pipeline';
import { storageProvider } from '@/modules/providers';
import { DocumentStatus } from '@prisma/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const summaries = await getSummariesByDocumentId(id);
    return NextResponse.json({ summaries });
  } catch (error) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const json = await request.json();

    // 1. Validate request body using Zod
    const validationResult = SummaryRequestSchema.safeParse(json);
    if (!validationResult.success) {
      const details = validationResult.error.issues.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      throw new AppError('VALIDATION_ERROR', 400, 'Invalid summary request parameters.', details);
    }

    const requestedLength = validationResult.data.length;
    const requestedTemplate = validationResult.data.template ?? 'general';
    const requestedLanguage = validationResult.data.language ?? 'en';

    // 2. Fetch Document to check if it exists and has completed processing successfully
    const doc = await getDocumentById(id);
    if (doc.status !== DocumentStatus.COMPLETED) {
      throw new AppError(
        'DOCUMENT_NOT_READY',
        400,
        `Document is currently in stage ${doc.currentStage}. Summaries can only be requested after processing is completed.`
      );
    }

    // 3. Cache Check: Reuse summary if it already exists in the database and is not a mock summary
    const existingSummary = await db.summary.findUnique({
      where: {
        documentId_length: {
          documentId: id,
          length: requestedLength,
        },
      },
    });

    if (existingSummary && !existingSummary.summary.includes('[Mock Summary')) {
      console.log(`API: Reusing cached summary of length ${requestedLength} for document ${id}`);
      return NextResponse.json({ summary: existingSummary }, { status: 200 });
    }


    // 4. Retrieve normalized content from object storage
    let textContent = '';
    try {
      const normalizedKey = `extracted/${id}.txt`;
      const buffer = await storageProvider.getObject(normalizedKey);
      textContent = buffer.toString('utf-8');
    } catch (storageError) {
      throw new AppError(
        'STORAGE_ERROR',
        500,
        `Failed to retrieve processed text content for summarization: ${(storageError as Error).message}`
      );
    }

    // 5. Generate summary using the configured strategy
    console.log(`API: Generating new summary of length ${requestedLength} for document ${id}`);
    const summaryResult = await summarizeDocumentContent(textContent, requestedLength, requestedTemplate, requestedLanguage);

    // 6. Persist summary to the database
    const summary = await createSummary({
      documentId: id,
      length: requestedLength,
      title: summaryResult.title,
      summary: summaryResult.summary,
      keyPoints: summaryResult.keyPoints,
      mainIdeas: summaryResult.mainIdeas,
      processingVersion: '1.0',
    });

    return NextResponse.json({ summary }, { status: 201 });
  } catch (error) {
    console.error('API Error in POST /api/documents/[id]/summaries:', error);
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
