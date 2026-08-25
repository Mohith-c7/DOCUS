export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { formatErrorResponse, AppError } from '@/modules/errors/api-error';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: collectionId } = await params;
    const { documentId } = await request.json();

    if (!documentId) {
      throw new AppError('VALIDATION_ERROR', 400, 'documentId is required.');
    }

    const [collection, document] = await Promise.all([
      db.collection.findUnique({ where: { id: collectionId } }),
      db.document.findUnique({ where: { id: documentId } }),
    ]);

    if (!collection) throw new AppError('NOT_FOUND', 404, 'Collection not found.');
    if (!document) throw new AppError('NOT_FOUND', 404, 'Document not found.');

    await db.documentCollection.upsert({
      where: { documentId_collectionId: { documentId, collectionId } },
      create: { documentId, collectionId },
      update: {},
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: collectionId } = await params;
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      throw new AppError('VALIDATION_ERROR', 400, 'documentId query param is required.');
    }

    await db.documentCollection.deleteMany({
      where: { collectionId, documentId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: collectionId } = await params;
    const items = await db.documentCollection.findMany({
      where: { collectionId },
      include: {
        document: { include: { summaries: { select: { length: true, title: true } } } },
      },
      orderBy: { addedAt: 'desc' },
    });
    return NextResponse.json({ documents: items.map((i) => i.document) });
  } catch (error) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
