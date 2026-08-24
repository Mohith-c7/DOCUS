import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { formatErrorResponse, AppError } from '@/modules/errors/api-error';

// POST /api/documents/[id]/share — generate share link
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const doc = await db.document.findUnique({ where: { id } });
    if (!doc) throw new AppError('NOT_FOUND', 404, 'Document not found.');

    // If already shared, return existing shareId
    if (doc.shareId) {
      return NextResponse.json({ shareId: doc.shareId, shared: true });
    }

    const shareId = crypto.randomUUID();
    await db.document.update({ where: { id }, data: { shareId } });

    return NextResponse.json({ shareId, shared: true }, { status: 201 });
  } catch (error) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

// DELETE /api/documents/[id]/share — revoke share link
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const doc = await db.document.findUnique({ where: { id } });
    if (!doc) throw new AppError('NOT_FOUND', 404, 'Document not found.');

    await db.document.update({ where: { id }, data: { shareId: null } });
    return NextResponse.json({ shared: false });
  } catch (error) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

// GET /api/documents/[id]/share — get share status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const doc = await db.document.findUnique({ where: { id }, select: { shareId: true } });
    if (!doc) throw new AppError('NOT_FOUND', 404, 'Document not found.');
    return NextResponse.json({ shareId: doc.shareId, shared: !!doc.shareId });
  } catch (error) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
