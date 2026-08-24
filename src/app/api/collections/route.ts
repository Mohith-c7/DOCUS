import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { formatErrorResponse, AppError, mapZodIssues } from '@/modules/errors/api-error';
import { z } from 'zod';

const CreateCollectionSchema = z.object({
  name: z.string().min(1, 'Collection name is required').max(100),
  description: z.string().max(300).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid color').optional(),
  icon: z.string().max(50).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      throw new AppError('VALIDATION_ERROR', 400, 'userId is required to list collections.');
    }

    const collections = await db.collection.findMany({
      where: { userId },
      include: {
        _count: { select: { documents: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ collections });
  } catch (error) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || json.userId;

    if (!userId) {
      throw new AppError('VALIDATION_ERROR', 400, 'userId is required to create a collection.');
    }

    const parsed = CreateCollectionSchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 400, 'Invalid collection data.', mapZodIssues(parsed.error.issues));
    }

    const collection = await db.collection.create({
      data: {
        userId,
        name: parsed.data.name,
        description: parsed.data.description,
        color: parsed.data.color || '#635bff',
        icon: parsed.data.icon || 'folder',
      },
      include: {
        _count: { select: { documents: true } },
      },
    });

    return NextResponse.json({ collection }, { status: 201 });
  } catch (error) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
