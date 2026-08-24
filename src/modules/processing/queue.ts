import { Queue, Worker, Job } from 'bullmq';
import { processDocument } from './pipeline';
import { SummaryTemplate, SupportedLanguage } from '../validation/schemas';

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);

const connection = {
  host: redisHost,
  port: redisPort,
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
  connectTimeout: 1000,
};

import { SummaryLength } from '@prisma/client';

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
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

let redisWarningLogged = false;

documentQueue.on('error', (err) => {
  if (!redisWarningLogged) {
    console.warn(`[Queue Info] Redis offline locally (${err.message}). Defaulting to automatic inline async background execution.`);
    redisWarningLogged = true;
  }
});

// Helper to push document IDs to the background worker queue
export async function addDocumentToQueue(
  documentId: string,
  options?: ProcessDocumentOptions
): Promise<Job | null> {
  console.log(`Queue: Adding document ${documentId} to task queue with options:`, options);
  
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
    // Serverless runtime fallback (Netlify): await pipeline execution directly to prevent lambda execution freeze
    try {
      await processDocument(documentId, options);
    } catch (procErr) {
      console.error(`Pipeline processing failed for document ${documentId}:`, procErr);
    }
    return null;
  }
}

// 2. Initialize Worker thread daemon with hot-reload caching for local development
let worker: Worker | undefined;

const workerHandler = async (job: Job) => {
  const { documentId, options } = job.data;
  console.log(`Worker: Processing job ${job.id} for document ${documentId}`);
  try {
    await processDocument(documentId, options);
    console.log(`Worker: Completed job ${job.id} for document ${documentId}`);
  } catch (error) {
    console.error(`Worker: Job ${job.id} failed for document ${documentId}:`, error);
    throw error;
  }
};

const globalForWorker = globalThis as unknown as { bullWorker?: Worker };

if (process.env.DISABLE_INLINE_WORKER !== 'true') {
  if (process.env.NODE_ENV === 'production') {
    worker = new Worker('document-processing', workerHandler, { connection });
    worker.on('error', () => {});
  } else {
    // Prevent Next.js compilation loops from spawning multiple concurrent TCP connections to Redis
    if (!globalForWorker.bullWorker) {
      globalForWorker.bullWorker = new Worker('document-processing', workerHandler, { connection });
      globalForWorker.bullWorker.on('error', () => {});
    }
    worker = globalForWorker.bullWorker;
  }
}

export { worker };
