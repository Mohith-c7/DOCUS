import { SummarizationProvider, SummaryResult } from './types';
import { StructuredSummarySchema, SummaryTemplate, SupportedLanguage, TEMPLATE_SYSTEM_PROMPTS } from '../validation/schemas';
import { AppError } from '../errors/api-error';

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', es: 'Spanish', fr: 'French',
  de: 'German', hi: 'Hindi', pt: 'Portuguese',
};

export class GeminiSummarizationProvider implements SummarizationProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string = process.env.GEMINI_API_KEY || '', model: string = 'gemini-3.6-flash') {
    this.apiKey = apiKey;
    this.model = model;
    console.log('🔑 Gemini API key loaded (length):', this.apiKey ? this.apiKey.length : 0);
    if (!this.apiKey) {
      console.warn('Warning: GEMINI_API_KEY is not defined in environment variables.');
    }
  }

  async summarize(
    content: string,
    length: 'SHORT' | 'MEDIUM' | 'LONG',
    template: SummaryTemplate = 'general',
    language: SupportedLanguage = 'en'
  ): Promise<SummaryResult> {
    if (!this.apiKey) {
      throw new AppError(
        'AI_PROVIDER_UNAVAILABLE',
        503,
        'Summarization failed: GEMINI_API_KEY environment variable is not configured.'
      );
    }

    // Mock mode for local testing
    if (this.apiKey === 'mock-gemini-api-key-for-foundation') {
      console.log(`[MOCK AI] Summarizing content of length ${content.length} characters to detail ${length}, template: ${template}, language: ${language}`);

      if (content.includes('FORCE_FAIL')) {
        throw new Error('Simulated upstream AI provider timeout/unavailability.');
      }

      if (content.includes('FORCE_INVALID_OUTPUT')) {
        const invalidResponse = { title: 'Mock Error Document', summary: 'Missing fields response.' };
        const validation = StructuredSummarySchema.safeParse(invalidResponse);
        if (!validation.success) {
          throw new AppError('INVALID_SUMMARY_OUTPUT', 502, 'AI generated output did not match the expected application schema.');
        }
        return validation.data;
      }

      return {
        title: `Summary of Document (${length})`,
        summary: `[Mock Summary - ${length}] This represents the normalized summary. It has a detail density configured for ${length} outputs. The input was analyzed and structured into relevant sections.`,
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

    // Build template-aware system instruction
    const templateContext = TEMPLATE_SYSTEM_PROMPTS[template] || '';
    const languageName = LANGUAGE_NAMES[language] || 'English';
    const isNonEnglish = language !== 'en';
    const languageInstruction = isNonEnglish
      ? `\nCRITICAL LANGUAGE MANDATE: You MUST write ALL output values (title, summary, keyPoints, mainIdeas) entirely in ${languageName} (${language}). Do NOT use English under any circumstances for the generated text. Every single sentence and bullet point MUST be translated to ${languageName}.`
      : '';

    const lengthGuidance = {
      SHORT: 'A concise 1-2 sentence overview, 2-3 key points, 2 main ideas.',
      MEDIUM: 'A balanced summary of 1-2 paragraphs, 3-5 key points, 2-3 main ideas.',
      LONG: 'A detailed summary of 3-4 paragraphs, 5-8 key points, 4-6 main ideas.',
    }[length];

    const systemInstruction = `You are a highly capable Document Summary Assistant specializing in ${template === 'general' ? 'general documents' : `${template} documents`}.

Your task: Analyze the provided document content and return a structured summary.
Target Language: ${languageName.toUpperCase()} (${language})
Requested detail level: ${length} — ${lengthGuidance}
${templateContext ? `\nDomain-specific focus:\n${templateContext}` : ''}${languageInstruction}

You MUST strictly output JSON conforming to the schema:
- title: A descriptive title for the document (in ${languageName}).
- summary: The text summary matching the requested length/detail level (in ${languageName}).
- keyPoints: A list of key bullets/takeaways (in ${languageName}).
- mainIdeas: A list of overarching core concepts or themes (in ${languageName}).`;

    const userPromptText = isNonEnglish
      ? `CRITICAL INSTRUCTION: Generate the entire summary in ${languageName} (${language}).\n\nHere is the document content:\n\n${content}`
      : `Here is the document content:\n\n${content}`;

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: userPromptText }],
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
            keyPoints: { type: 'ARRAY', items: { type: 'STRING' } },
            mainIdeas: { type: 'ARRAY', items: { type: 'STRING' } },
          },
          required: ['title', 'summary', 'keyPoints', 'mainIdeas'],
        },
      },
    };

    const modelsToTry = [
      'gemini-3.6-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
    ].filter((value, index, self) => self.indexOf(value) === index);

    let lastError: Error | null = null;

    for (const targetModel of modelsToTry) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${this.apiKey}`;
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(20000),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          console.error(`[Gemini API Error] Model ${targetModel} returned status ${response.status}:`, errorText);
          lastError = new Error(`Gemini API model ${targetModel} returned status ${response.status}: ${errorText}`);
          continue;
        }

        const json = await response.json();
        const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!rawText) throw new Error('Gemini API returned empty text in candidate content.');

        const cleanedText = rawText
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim();

        const parsed = JSON.parse(cleanedText);
        const validation = StructuredSummarySchema.safeParse(parsed);

        if (!validation.success) {
          console.error('[Gemini API] Output validation failed:', validation.error);
          throw new AppError('INVALID_SUMMARY_OUTPUT', 502, 'AI generated output did not match the expected application schema.');
        }

        return validation.data;
      } catch (error) {
        if (error instanceof AppError) throw error;
        lastError = error as Error;
        console.warn(`[Gemini Fallback] Candidate model ${targetModel} failed (${(error as Error).message}). Trying next candidate...`);
      }
    }

    throw new AppError(
      'SUMMARIZATION_FAILED',
      502,
      `AI summarization failed: ${lastError?.message || 'Unknown error'}`
    );
  }
}
