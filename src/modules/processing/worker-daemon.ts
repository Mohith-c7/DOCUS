import { Worker } from 'bullmq';
import { processDocument } from './pipeline';

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);

const connection = {
  host: redisHost,
  port: redisPort,
};

console.log('Worker Daemon: Starting standalone background document processing worker...');

const worker = new Worker(
  'document-processing',
  async (job) => {
    const { documentId } = job.data;
    console.log(`Worker Daemon: Processing job ${job.id} for document ${documentId}`);
    try {
      await processDocument(documentId);
      console.log(`Worker Daemon: Completed job ${job.id} for document ${documentId}`);
    } catch (error) {
      console.error(`Worker Daemon: Job ${job.id} failed for document ${documentId}:`, error);
      throw error;
    }
  },
  { connection }
);

worker.on('failed', (job, err) => {
  console.error(`Worker Daemon: Job ${job?.id} failed with error:`, err);
});

worker.on('error', (err) => {
  console.error('Worker Daemon: Connection error:', err);
});

console.log('Worker Daemon: Online and listening for tasks on Redis queue.');
