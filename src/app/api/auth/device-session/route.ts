import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { formatErrorResponse } from '@/modules/errors/api-error';

export async function POST(request: NextRequest) {
  try {
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'Unknown Device';

    const body = await request.json().catch(() => ({}));
    const { userId } = body;
    let { anonymousSessionId } = body;

    let deviceSession = null;

    if (anonymousSessionId) {
      deviceSession = await db.deviceSession.upsert({
        where: { anonymousSessionId },
        update: {
          ipAddress: clientIp,
          userAgent,
          userId: userId || undefined,
          lastActiveAt: new Date(),
        },
        create: {
          anonymousSessionId,
          ipAddress: clientIp,
          userAgent,
          userId: userId || undefined,
        },
      });
    } else {
      // Look up matching device by IP + UserAgent or IP address
      deviceSession = await db.deviceSession.findFirst({
        where: {
          OR: [
            { ipAddress: clientIp, userAgent },
            { ipAddress: clientIp },
          ],
        },
        orderBy: { lastActiveAt: 'desc' },
      });

      if (deviceSession) {
        anonymousSessionId = deviceSession.anonymousSessionId;
      }
    }

    // Fetch documents associated with this device session or IP
    const documents = anonymousSessionId
      ? await db.document.findMany({
          where: {
            OR: [
              { anonymousSessionId },
              { ipAddress: clientIp },
            ],
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            summaries: {
              select: { length: true, title: true, summary: true },
            },
          },
        })
      : [];

    const response = NextResponse.json({
      success: true,
      deviceRecognized: Boolean(deviceSession),
      anonymousSessionId: anonymousSessionId || null,
      ipAddress: clientIp,
      documentsCount: documents.length,
      recentDocuments: documents,
    });

    // Set HTTP-only device token cookie for fail-safe persistence
    if (anonymousSessionId) {
      response.cookies.set('docus_device_token', anonymousSessionId, {
        httpOnly: false,
        path: '/',
        maxAge: 60 * 60 * 24 * 365, // 1 year
      });
    }

    return response;
  } catch (error) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
