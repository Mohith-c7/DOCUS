import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { formatErrorResponse, AppError, mapZodIssues } from '@/modules/errors/api-error';
import { z } from 'zod';

const UpdateCollectionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(300).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(50).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const json = await request.json();
    const parsed = UpdateCollectionSchema.safeParse(json);

    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 400, 'Invalid update data.', mapZodIssues(parsed.error.issues));
    }

    const existing = await db.collection.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('NOT_FOUND', 404, `Collection ${id} not found.`);
    }

    const collection = await db.collection.update({
      where: { id },
      data: parsed.data,
      include: { _count: { select: { documents: true } } },
    });

    return NextResponse.json({ collection });
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
    const { id } = await params;
    const existing = await db.collection.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('NOT_FOUND', 404, `Collection ${id} not found.`);
    }
    await db.collection.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
