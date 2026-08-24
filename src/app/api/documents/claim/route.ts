import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { formatErrorResponse, AppError } from '@/modules/errors/api-error';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { anonymousSessionId, userId } = body;

    if (!anonymousSessionId || !userId) {
      throw new AppError('VALIDATION_ERROR', 400, 'Both anonymousSessionId and userId are required to claim documents.');
    }

    const updated = await db.document.updateMany({
      where: {
        anonymousSessionId,
        OR: [
          { userId: null },
          { userId: '' }
        ]
      },
      data: {
        userId,
      },
    });

    console.log(`API Claim: Transferred ${updated.count} documents from session "${anonymousSessionId}" to user "${userId}".`);

    return NextResponse.json({
      success: true,
      claimedCount: updated.count,
    });
  } catch (error) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
