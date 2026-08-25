export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DocumentStatus } from '@prisma/client';

export const revalidate = 3600; // 1 hour cache

export async function GET() {
  try {
    const [totalDocuments, totalSummaries] = await Promise.all([
      db.document.count({ where: { status: DocumentStatus.COMPLETED } }),
      db.summary.count(),
    ]);
    return NextResponse.json({ totalDocuments, totalSummaries });
  } catch {
    return NextResponse.json({ totalDocuments: 0, totalSummaries: 0 });
  }
}
