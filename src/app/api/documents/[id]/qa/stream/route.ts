import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { AppError } from '@/modules/errors/api-error';
import { DocumentStatus, MessageRole } from '@prisma/client';
import { z } from 'zod';

const StreamQuestionSchema = z.object({
  question: z.string().min(1).max(2000),
  sessionId: z.string().uuid().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: documentId } = await params;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const json = await request.json();
        const parsed = StreamQuestionSchema.safeParse(json);
        if (!parsed.success) {
          send({ type: 'error', message: 'Invalid request.' });
          controller.close();
          return;
        }

        const doc = await db.document.findUnique({ where: { id: documentId } });
        if (!doc || doc.status !== DocumentStatus.COMPLETED) {
          send({ type: 'error', message: 'Document not ready.' });
          controller.close();
          return;
        }

        // Get or create Q&A session
        let session = parsed.data.sessionId
          ? await db.qASession.findUnique({ where: { id: parsed.data.sessionId } })
          : null;
        if (!session) {
          session = await db.qASession.create({ data: { documentId } });
        }

        send({ type: 'session', sessionId: session.id });

        // Persist user message
        await db.qAMessage.create({
          data: { sessionId: session.id, role: MessageRole.USER, content: parsed.data.question },
        });

        // Get document text context
        const { storageProvider } = await import('@/modules/providers');
        let textContent = '';
        try {
          const buffer = await storageProvider.getObject(`extracted/${documentId}.txt`);
          textContent = buffer.toString('utf-8').slice(0, 12000);
        } catch {
          const summary = await db.summary.findFirst({ where: { documentId } });
          textContent = summary
            ? `${summary.title}\n\n${summary.summary}\n\nKey Points:\n${summary.keyPoints.join('\n')}`
            : '';
        }

        const apiKey = process.env.GEMINI_API_KEY || '';

        // Mock mode
        if (!apiKey || apiKey === 'mock-gemini-api-key-for-foundation') {
          const mockWords = `This is a streaming mock answer to: "${parsed.data.question}". In production this uses Gemini AI with document context.`.split(' ');
          let fullAnswer = '';
          for (const word of mockWords) {
            await new Promise((r) => setTimeout(r, 60));
            fullAnswer += (fullAnswer ? ' ' : '') + word;
            send({ type: 'token', token: word + ' ' });
          }
          await db.qAMessage.create({
            data: { sessionId: session.id, role: MessageRole.ASSISTANT, content: fullAnswer },
          });
          send({ type: 'done', sessionId: session.id });
          controller.close();
          return;
        }

        // Get history for context
        const history = await db.qAMessage.findMany({
          where: { sessionId: session.id },
          orderBy: { createdAt: 'desc' },
          take: 12,
        });
        history.reverse();

        const systemInstruction = `You are a helpful Document Assistant. Answer questions about this document precisely using ONLY the content provided. Do not hallucinate. If the answer isn't in the document, say so.

DOCUMENT CONTENT:
${textContent}`;

        const contents = history
          .slice(0, -1)
          .map((m) => ({
            role: m.role === MessageRole.USER ? 'user' : 'model',
            parts: [{ text: m.content }],
          }));
        contents.push({ role: 'user', parts: [{ text: parsed.data.question }] });

        const requestBody = {
          contents,
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
        };

        const modelsToTry = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
        let geminiResponse: Response | null = null;

        for (const targetModel of modelsToTry) {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:streamGenerateContent?alt=sse`;
          try {
            const resp = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
              body: JSON.stringify(requestBody),
              signal: AbortSignal.timeout(45000),
            });
            if (resp.ok && resp.body) {
              geminiResponse = resp;
              break;
            }
          } catch {
            // try next model
          }
        }

        if (!geminiResponse || !geminiResponse.body) {
          send({ type: 'error', message: 'AI Q&A service unavailable.' });
          controller.close();
          return;
        }

        // Stream tokens from Gemini SSE
        const reader = geminiResponse.body.getReader();
        const decoder = new TextDecoder();
        let fullAnswer = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (!raw || raw === '[DONE]') continue;
            try {
              const chunk = JSON.parse(raw);
              const token = chunk.candidates?.[0]?.content?.parts?.[0]?.text || '';
              if (token) {
                fullAnswer += token;
                send({ type: 'token', token });
              }
            } catch {
              // malformed chunk, skip
            }
          }
        }

        // Persist full answer
        if (fullAnswer) {
          await db.qAMessage.create({
            data: { sessionId: session.id, role: MessageRole.ASSISTANT, content: fullAnswer },
          });
        }

        send({ type: 'done', sessionId: session.id });
      } catch (err) {
        const message = err instanceof AppError ? err.message : 'An error occurred.';
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
