export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { formatErrorResponse, AppError } from '@/modules/errors/api-error';
import { DocumentStatus } from '@prisma/client';

// Rate limit tracker (simple in-memory, good enough for moderate traffic)
const requestCounts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const limit = 30;

  const entry = requestCounts.get(ip);
  if (!entry || entry.resetAt < now) {
    requestCounts.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shareId: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { shareId } = await params;

    const doc = await db.document.findUnique({
      where: { shareId },
      include: {
        summaries: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!doc || !doc.shareId) {
      throw new AppError('NOT_FOUND', 404, 'This shared document could not be found or the link has been revoked.');
    }

    if (doc.status !== DocumentStatus.COMPLETED) {
      throw new AppError('DOCUMENT_NOT_READY', 400, 'This document has not finished processing yet.');
    }

    // Return safe public subset — no internal IDs, no user info
    return NextResponse.json({
      document: {
        shareId: doc.shareId,
        originalFileName: doc.originalFileName,
        fileType: doc.fileType,
        createdAt: doc.createdAt,
        title: doc.userTitle || doc.summaries[0]?.title || doc.originalFileName,
        summaries: doc.summaries.map((s) => ({
          length: s.length,
          title: s.title,
          summary: s.summary,
          keyPoints: s.keyPoints,
          mainIdeas: s.mainIdeas,
        })),
      },
    });
  } catch (error) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
