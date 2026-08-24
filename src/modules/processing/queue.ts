import { Queue, Worker, Job } from 'bullmq';
import { processDocument } from './pipeline';
import { SummaryTemplate, SupportedLanguage } from '../validation/schemas';
import { SummaryLength } from '@prisma/client';

const redisHost = process.env.REDIS_HOST;
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);

const connection = {
  host: redisHost || 'localhost',
  port: redisPort,
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
  connectTimeout: 1000,
};

export interface ProcessDocumentOptions {
  length?: SummaryLength;
  template?: SummaryTemplate;
  language?: SupportedLanguage;
}

// 1. Declare the BullMQ Queue for document processing
export const documentQueue = new Queue('document-processing', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

let redisWarningLogged = false;

documentQueue.on('error', (err) => {
  if (!redisWarningLogged) {
    console.warn(`[Queue Info] Redis offline (${err.message}). Defaulting to automatic inline serverless execution.`);
    redisWarningLogged = true;
  }
});

// Helper to push document IDs to the background worker queue
export async function addDocumentToQueue(
  documentId: string,
  options?: ProcessDocumentOptions
): Promise<Job | null> {
  console.log(`Queue: Processing document ${documentId} with options:`, options);
  
  const isServerless = process.env.NETLIFY === 'true' || process.env.VERCEL === 'true' || !redisHost;

  if (isServerless) {
    console.log(`Queue: Serverless environment detected. Executing direct pipeline processing for document ${documentId}...`);
    try {
      await processDocument(documentId, options);
    } catch (procErr) {
      console.error(`Pipeline processing failed for document ${documentId}:`, procErr);
    }
    return null;
  }

  const addWithTimeout = Promise.race([
    documentQueue.add('process', { documentId, options }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Redis connection timeout (offline)')), 1500)
    ),
  ]);

  try {
    return await addWithTimeout;
  } catch (queueErr) {
    console.warn(`Queue: Redis queue unavailable (${(queueErr as Error).message}). Executing direct pipeline processing for document ${documentId}...`);
    try {
      await processDocument(documentId, options);
    } catch (procErr) {
      console.error(`Pipeline processing failed for document ${documentId}:`, procErr);
    }
    return null;
  }
}

// 2. Initialize Worker thread daemon conditionally (only when Redis is explicitly configured)
export const workerHandler = async (job: Job<{ documentId: string; options?: ProcessDocumentOptions }>) => {
  const { documentId, options } = job.data;
  console.log(`Worker: Pickup job ${job.id} for document: ${documentId}`);

  try {
    await processDocument(documentId, options);
    console.log(`Worker: Successfully processed document ${documentId}`);
  } catch (error) {
    console.error(`Worker: Job ${job.id} failed for document ${documentId}:`, error);
    throw error;
  }
};

export let worker: Worker | undefined;

const globalForWorker = globalThis as unknown as { bullWorker?: Worker };
const isServerless = process.env.NETLIFY === 'true' || process.env.VERCEL === 'true' || !redisHost;

if (!isServerless && process.env.DISABLE_INLINE_WORKER !== 'true') {
  try {
    if (process.env.NODE_ENV === 'production') {
      worker = new Worker('document-processing', workerHandler, { connection });
      worker.on('error', () => {});
    } else {
      if (!globalForWorker.bullWorker) {
        globalForWorker.bullWorker = new Worker('document-processing', workerHandler, { connection });
        globalForWorker.bullWorker.on('error', () => {});
      }
      worker = globalForWorker.bullWorker;
    }
  } catch (workerErr) {
    console.warn('[Queue] BullMQ worker initialization bypassed:', workerErr);
  }
}
