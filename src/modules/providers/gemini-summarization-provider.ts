import { SummarizationProvider, SummaryResult } from './types';
import { StructuredSummarySchema } from '../validation/schemas';
import { AppError } from '../errors/api-error';

export class GeminiSummarizationProvider implements SummarizationProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string = process.env.GEMINI_API_KEY || '', model: string = 'gemini-1.5-flash') {
    this.apiKey = apiKey;
    this.model = model;
    if (!this.apiKey) {
      console.warn('Warning: GEMINI_API_KEY is not defined in environment variables.');
    }
  }

  async summarize(content: string, length: 'SHORT' | 'MEDIUM' | 'LONG'): Promise<SummaryResult> {
    if (!this.apiKey) {
      throw new AppError(
        'AI_PROVIDER_UNAVAILABLE',
        503,
        'Summarization failed: GEMINI_API_KEY environment variable is not configured.'
      );
    }

    // Mock mode for local testing
    if (this.apiKey === 'mock-gemini-api-key-for-foundation') {
      console.log(`[MOCK AI] Summarizing content of length ${content.length} characters to detail ${length}`);

      if (content.includes('FORCE_FAIL')) {
        throw new Error('Simulated upstream AI provider timeout/unavailability.');
      }

      if (content.includes('FORCE_INVALID_OUTPUT')) {
        // Return a shape that fails Zod validation (missing keyPoints/mainIdeas)
        const invalidResponse = {
          title: 'Mock Error Document',
          summary: 'Missing fields response.',
        };
        const validation = StructuredSummarySchema.safeParse(invalidResponse);
        if (!validation.success) {
          throw new AppError(
            'INVALID_SUMMARY_OUTPUT',
            502,
            'AI generated output did not match the expected application schema.'
          );
        }
        return validation.data;
      }

      // Return valid mock summary matching Zod constraints
      return {
        title: `Summary of Document (${length})`,
        summary: `[Mock Summary - ${length}] This represents the normalized summary. It has a detail density configured for ${length} outputs. ` +
                 `The input was analyzed and structured into relevant sections.`,
        keyPoints: [
          `Key point 1 for ${length} detail analysis.`,
          `Key point 2 describing the major theme.`,
          `Key point 3 listing secondary details.`
        ],
        mainIdeas: [
          `Core concept 1 derived from document context.`,
          `Core concept 2 representing major thematic layout.`
        ]
      };
    }

    // Real API call mode
    const systemInstruction = `
You are a highly capable Document Summary Assistant. Your task is to analyze the provided document content and return a structured summary.
The requested summary detail level is: ${length}.
- SHORT: A concise 1-2 sentence overview and 2-3 key points.
- MEDIUM: A balanced summary of 1-2 paragraphs, 3-5 key points, and 2-3 main ideas.
- LONG: A detailed summary of 3-4 paragraphs, 5-8 key points, and 4-6 main ideas.

You MUST strictly output JSON conforming to the requested schema:
- title: A suitable descriptive title for the document.
- summary: The text summary of the document matching the requested length/detail level.
- keyPoints: A list of key bullets/takeaways from the document.
- mainIdeas: A list of the overarching core concepts or themes.
`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: `Here is the document content:\n\n${content}` }],
        },
      ],
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      generationConfig: {
        response_mime_type: 'application/json',
        response_schema: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING' },
            summary: { type: 'STRING' },
            keyPoints: {
              type: 'ARRAY',
              items: { type: 'STRING' },
            },
            mainIdeas: {
              type: 'ARRAY',
              items: { type: 'STRING' },
            },
          },
          required: ['title', 'summary', 'keyPoints', 'mainIdeas'],
        },
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Gemini API returned HTTP status ${response.status}`);
      }

      const json = await response.json();
      const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        throw new Error('Gemini API returned empty text in candidate content.');
      }

      const parsed = JSON.parse(rawText);
      const validation = StructuredSummarySchema.safeParse(parsed);

      if (!validation.success) {
        throw new AppError(
          'INVALID_SUMMARY_OUTPUT',
          502,
          'AI generated output did not match the expected application schema.'
        );
      }

      return validation.data;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        'SUMMARIZATION_FAILED',
        502,
        `AI summarization failed: ${(error as Error).message}`
      );
    }
  }
}
