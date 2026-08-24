import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { formatErrorResponse, AppError, mapZodIssues } from '@/modules/errors/api-error';
import { DocumentStatus, MessageRole } from '@prisma/client';
import { z } from 'zod';

const AskQuestionSchema = z.object({
  question: z.string().min(1, 'Question cannot be empty').max(2000, 'Question too long'),
  sessionId: z.string().uuid().optional(),
});

// GET /api/documents/[id]/qa — get Q&A session history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;

    const session = await db.qASession.findFirst({
      where: { documentId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ session: session ?? null });
  } catch (error) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

// POST /api/documents/[id]/qa — send a question, returns full answer (non-streaming)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;
    const json = await request.json();

    const parsed = AskQuestionSchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 400, 'Invalid Q&A request.', mapZodIssues(parsed.error.issues));
    }

    const doc = await db.document.findUnique({ where: { id: documentId } });
    if (!doc) throw new AppError('NOT_FOUND', 404, 'Document not found.');
    if (doc.status !== DocumentStatus.COMPLETED) {
      throw new AppError('DOCUMENT_NOT_READY', 400, 'Document has not finished processing yet.');
    }

    // Get or create Q&A session
    let session = parsed.data.sessionId
      ? await db.qASession.findUnique({ where: { id: parsed.data.sessionId } })
      : null;

    if (!session) {
      session = await db.qASession.create({ data: { documentId } });
    }

    // Persist user message
    await db.qAMessage.create({
      data: { sessionId: session.id, role: MessageRole.USER, content: parsed.data.question },
    });

    // Retrieve document text content from storage for context
    const { storageProvider } = await import('@/modules/providers');
    let textContent = '';
    try {
      const normalizedKey = `extracted/${documentId}.txt`;
      const buffer = await storageProvider.getObject(normalizedKey);
      textContent = buffer.toString('utf-8').slice(0, 12000); // cap context
    } catch {
      // If no extracted text, use summary as fallback context
      const summary = await db.summary.findFirst({ where: { documentId } });
      textContent = summary ? `${summary.title}\n\n${summary.summary}\n\nKey Points:\n${summary.keyPoints.join('\n')}` : '';
    }

    // Get previous messages for context (last 6 exchanges = 12 messages)
    const history = await db.qAMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'desc' },
      take: 12,
    });
    history.reverse();

    // Build Gemini request
    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey || apiKey === 'mock-gemini-api-key-for-foundation') {
      const mockAnswer = `This is a mock answer to your question: "${parsed.data.question}". In production, this would be answered by Gemini AI using the document content as context.`;
      const assistantMsg = await db.qAMessage.create({
        data: { sessionId: session.id, role: MessageRole.ASSISTANT, content: mockAnswer },
      });
      return NextResponse.json({ sessionId: session.id, message: assistantMsg });
    }

    const systemInstruction = `You are a helpful Document Assistant. Your job is to answer questions about a specific document. 
Use ONLY the document content provided as your knowledge base. Be precise, concise, and cite relevant parts of the document.
If the answer is not in the document, say so honestly. Do not hallucinate.

DOCUMENT CONTENT:
${textContent}`;

    const contents = history
      .slice(0, -1) // exclude the question we just saved (it's the last one)
      .map((m) => ({
        role: m.role === MessageRole.USER ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

    // Add current question
    contents.push({ role: 'user', parts: [{ text: parsed.data.question }] });

    const requestBody = {
      contents,
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
    };

    const modelsToTry = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    let geminiJson: Record<string, unknown> | null = null;

    for (const targetModel of modelsToTry) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent`;
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(30000),
        });
        if (response.ok) {
          geminiJson = await response.json();
          break;
        }
      } catch {
        // try next model
      }
    }

    if (!geminiJson) {
      throw new AppError('AI_PROVIDER_UNAVAILABLE', 502, 'AI Q&A service unavailable. Please try again.');
    }

    const candidates = geminiJson.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined;
    const answerText = candidates?.[0]?.content?.parts?.[0]?.text || 'I could not generate an answer. Please try again.';

    const assistantMsg = await db.qAMessage.create({
      data: { sessionId: session.id, role: MessageRole.ASSISTANT, content: answerText },
    });

    return NextResponse.json({ sessionId: session.id, message: assistantMsg });
  } catch (error) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
