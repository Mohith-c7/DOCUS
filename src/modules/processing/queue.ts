import { Queue, Worker, Job } from 'bullmq';
import { processDocument } from './pipeline';

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);

const connection = {
  host: redisHost,
  port: redisPort,
};

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

// Helper to push document IDs to the background worker queue
export async function addDocumentToQueue(documentId: string): Promise<Job> {
  console.log(`Queue: Adding document ${documentId} to task queue...`);
  return documentQueue.add('process', { documentId });
}

// 2. Initialize Worker thread daemon with hot-reload caching for local development
let worker: Worker | undefined;

const workerHandler = async (job: Job) => {
  const { documentId } = job.data;
  console.log(`Worker: Processing job ${job.id} for document ${documentId}`);
  try {
    await processDocument(documentId);
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
  } else {
    // Prevent Next.js compilation loops from spawning multiple concurrent TCP connections to Redis
    if (!globalForWorker.bullWorker) {
      globalForWorker.bullWorker = new Worker('document-processing', workerHandler, { connection });
    }
    worker = globalForWorker.bullWorker;
  }
}

export { worker };
