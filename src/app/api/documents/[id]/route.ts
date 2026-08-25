export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getDocumentById, updateDocumentStage } from '@/modules/documents/service';
import { formatErrorResponse, AppError } from '@/modules/errors/api-error';
import { ProcessingStage, ExtractionMethod } from '@prisma/client';
import { z } from 'zod';

const PatchDocumentSchema = z.object({
  stage: z.nativeEnum(ProcessingStage),
  extractionMethod: z.nativeEnum(ExtractionMethod).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const document = await getDocumentById(id);
    return NextResponse.json({ document });
  } catch (error) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const json = await request.json();
    const result = PatchDocumentSchema.safeParse(json);

    if (!result.success) {
      const details = result.error.issues.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      throw new AppError('VALIDATION_ERROR', 400, 'The request contains invalid data.', details);
    }

    const document = await updateDocumentStage(id, result.data.stage, {
      extractionMethod: result.data.extractionMethod,
    });

    return NextResponse.json({ document });
  } catch (error) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
