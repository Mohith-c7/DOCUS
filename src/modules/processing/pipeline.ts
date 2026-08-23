import { getDocumentById, updateDocumentStage } from '../documents/service';
import { pdfExtractionProvider, ocrProvider, summarizationProvider, storageProvider } from '../providers';
import { FileType, ProcessingStage, SummaryLength } from '@prisma/client';
import { AppError } from '../errors/api-error';
import { chunkText } from './chunker';
import { createSummary } from '../summaries/service';

// Configurable constants for text usability checks (no magic numbers)
export const MIN_CHARACTERS = 50;
export const MIN_NON_WHITESPACE_RATIO = 0.1;

// Configurable thresholds for summarization strategy
export const DIRECT_SUMMARIZATION_THRESHOLD_CHARS = 15000;
export const CHUNK_SIZE_LIMIT = 8000;
export const MAX_CONCURRENT_AI_REQUESTS = 3;

export function isTextUsable(text: string | null | undefined): boolean {
  if (!text) return false;
  const charCount = text.length;
  if (charCount < MIN_CHARACTERS) {
    return false;
  }

  const nonWhitespaceCount = text.replace(/\s/g, '').length;
  const ratio = nonWhitespaceCount / charCount;
  return ratio >= MIN_NON_WHITESPACE_RATIO;
}

export function normalizeText(text: string): string {
  if (!text) return '';

  let cleaned = text.replace(/\r\n/g, '\n');
  cleaned = cleaned.replace(/[ \t]+/g, ' ');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  cleaned = cleaned
    .split('\n')
    .map((line) => line.trim())
    .join('\n');

  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned.trim();
}

/**
 * Bounded concurrency map helper to process chunk tasks in parallel.
 */
async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: Promise<R>[] = [];
  const executing: Promise<void>[] = [];
  
  for (let i = 0; i < items.length; i++) {
    const p = Promise.resolve().then(() => fn(items[i], i));
    results.push(p);
    
    if (concurrency < items.length) {
      const e: Promise<void> = p.then(() => {
        executing.splice(executing.indexOf(e), 1);
      });
      executing.push(e);
      if (executing.length >= concurrency) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(results);
}

/**
 * Handles summarization strategy (direct vs hierarchical) based on content size.
 */
export async function summarizeDocumentContent(
  content: string,
  length: SummaryLength
): Promise<{ title: string; summary: string; keyPoints: string[]; mainIdeas: string[] }> {
  if (content.length <= DIRECT_SUMMARIZATION_THRESHOLD_CHARS) {
    // Strategy: Direct AI Summary
    console.log(`Pipeline: Executing direct summarization strategy (${content.length} chars)`);
    return summarizationProvider.summarize(content, length);
  }

  // Strategy: Hierarchical Summarization (Chunking -> Partial Summaries -> Aggregation)
  console.log(`Pipeline: Executing hierarchical chunked summarization strategy (${content.length} chars)`);
  const chunks = chunkText(content, CHUNK_SIZE_LIMIT);
  console.log(`Pipeline: Split document into ${chunks.length} chunks`);

  // Generate partial summaries for each chunk concurrently (bounded limit)
  const partialSummaries = await mapConcurrent(
    chunks,
    MAX_CONCURRENT_AI_REQUESTS,
    async (chunk, index) => {
      console.log(`Pipeline: Summarizing chunk ${index + 1}/${chunks.length} (${chunk.length} chars)`);
      return summarizationProvider.summarize(chunk, 'SHORT');
    }
  );

  // Aggregate partial summaries into structured context for final summarization
  const aggregatedText = partialSummaries
    .map(
      (p, index) =>
        `### Section ${index + 1}: ${p.title}\n**Summary:** ${p.summary}\n**Key Takeaways:** ${p.keyPoints.join(
          '; '
        )}`
    )
    .join('\n\n');

  console.log(`Pipeline: Requesting final aggregation summary from aggregated text (${aggregatedText.length} chars)`);
  return summarizationProvider.summarize(aggregatedText, length);
}

export async function processDocument(documentId: string): Promise<void> {
  const pipelineStart = Date.now();
  console.log(`Pipeline: Starting background processing for document: ${documentId}`);
  let doc = await getDocumentById(documentId);

  try {
    // 1. Initial stage change to EXTRACTING
    doc = await updateDocumentStage(documentId, ProcessingStage.EXTRACTING);

    let extractedText = '';
    let usedOCR = false;
    const extractionStart = Date.now();

    if (doc.fileType === FileType.PDF) {
      console.log(`Pipeline: Attempting native PDF extraction for: ${doc.originalFileName}`);
      try {
        const result = await pdfExtractionProvider.extract(doc.storageKey);
        extractedText = result.text;
        console.log(`Pipeline: Native PDF extraction finished in ${Date.now() - extractionStart}ms`);
      } catch (extError) {
        console.warn(`Pipeline: Native PDF extraction crashed. Falling back to OCR.`, extError);
      }

      const usable = isTextUsable(extractedText);
      if (!usable) {
        // Fallback to OCR
        console.log(`Pipeline: PDF native text is insufficient or empty. Routing to OCR...`);
        doc = await updateDocumentStage(documentId, ProcessingStage.OCR_PROCESSING);
        const ocrStart = Date.now();
        const ocrResult = await ocrProvider.extract(doc.storageKey);
        extractedText = ocrResult.text;
        console.log(`Pipeline: OCR text extraction finished in ${Date.now() - ocrStart}ms`);
        usedOCR = true;
      }
    } else if (doc.fileType === FileType.IMAGE) {
      console.log(`Pipeline: Ingesting image document. Routing to OCR...`);
      doc = await updateDocumentStage(documentId, ProcessingStage.OCR_PROCESSING);
      const ocrStart = Date.now();
      const ocrResult = await ocrProvider.extract(doc.storageKey);
      extractedText = ocrResult.text;
      console.log(`Pipeline: OCR text extraction finished in ${Date.now() - ocrStart}ms`);
      usedOCR = true;
    }

    // Verify extraction output usability
    if (!isTextUsable(extractedText)) {
      throw new AppError(
        'NO_EXTRACTABLE_CONTENT',
        422,
        'The document contains no readable text contents via either native parsing or OCR.'
      );
    }

    // Update extractionMethod in database
    await updateDocumentStage(documentId, doc.currentStage, {
      extractionMethod: usedOCR ? 'OCR' : 'NATIVE',
    });

    // 2. Normalization phase
    doc = await updateDocumentStage(documentId, ProcessingStage.NORMALIZING);
    const normalizationStart = Date.now();
    const normalizedText = normalizeText(extractedText);
    if (!normalizedText) {
      throw new AppError(
        'NO_EXTRACTABLE_CONTENT',
        422,
        'Extraction completed but text normalization resulted in empty content.'
      );
    }

    // Save normalized text back to object storage
    const normalizedKey = `extracted/${documentId}.txt`;
    await storageProvider.upload(
      Buffer.from(normalizedText, 'utf-8'),
      normalizedKey,
      'text/plain'
    );
    console.log(`Pipeline: Normalization completed in ${Date.now() - normalizationStart}ms`);

    // 3. Summarization phase
    doc = await updateDocumentStage(documentId, ProcessingStage.SUMMARIZING);
    const summarizationStart = Date.now();

    // Generate and persist default MEDIUM summary
    const summaryResult = await summarizeDocumentContent(normalizedText, SummaryLength.MEDIUM);

    await createSummary({
      documentId: doc.id,
      length: SummaryLength.MEDIUM,
      title: summaryResult.title,
      summary: summaryResult.summary,
      keyPoints: summaryResult.keyPoints,
      mainIdeas: summaryResult.mainIdeas,
      processingVersion: '1.0',
    });
    console.log(`Pipeline: Initial MEDIUM summary completed in ${Date.now() - summarizationStart}ms`);

    // 4. Ingestion complete
    await updateDocumentStage(documentId, ProcessingStage.COMPLETED);
    console.log(`Pipeline: Processing completed successfully for document ${documentId} in ${Date.now() - pipelineStart}ms`);
  } catch (error) {
    console.error(`Pipeline failure for document ${documentId} after ${Date.now() - pipelineStart}ms:`, error);

    try {
      await updateDocumentStage(documentId, ProcessingStage.FAILED, {
        failedAt: new Date(),
      });
    } catch (dbError) {
      console.error(`Failed to transition document ${documentId} to FAILED:`, dbError);
    }
  }
}
