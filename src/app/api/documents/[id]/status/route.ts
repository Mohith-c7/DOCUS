import { NextRequest, NextResponse } from 'next/server';
import { getDocumentById } from '@/modules/documents/service';
import { formatErrorResponse } from '@/modules/errors/api-error';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const document = await getDocumentById(id);

    return NextResponse.json({
      documentId: document.id,
      status: document.status,
      currentStage: document.currentStage,
      updatedAt: document.updatedAt.toISOString(),
      completedAt: document.completedAt ? document.completedAt.toISOString() : null,
      failedAt: document.failedAt ? document.failedAt.toISOString() : null,
    });
  } catch (error) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
