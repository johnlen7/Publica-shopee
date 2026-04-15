import { Worker } from 'bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '@publica/shared';
import { connection } from './connection.js';
import { env } from './env.js';
import { logger } from './logger.js';
import { tokenRefreshQueue } from './queues.js';
import { processEcho } from './processors/echo.js';
import {
  processCancelUpload,
  processInitUpload,
  processPollTranscoding,
} from './processors/upload.js';
import { processPublishVideo } from './processors/publish.js';
import { processTokenRefresh } from './processors/token-refresh.js';

const uploadWorker = new Worker(
  QUEUE_NAMES.UPLOAD,
  async (job) => {
    switch (job.name) {
      case JOB_NAMES.ECHO:
        return processEcho(job);
      case JOB_NAMES.INIT_UPLOAD:
        return processInitUpload(job);
      case JOB_NAMES.POLL_TRANSCODING:
      case 'poll-transcoding':
        return processPollTranscoding(job);
      case 'cancel-upload':
        return processCancelUpload(job);
      default:
        throw new Error(`Job desconhecido na fila upload: ${job.name}`);
    }
  },
  { connection, concurrency: env.WORKER_CONCURRENCY },
);

const publishWorker = new Worker(
  QUEUE_NAMES.PUBLISH,
  async (job) => {
    if (job.name === JOB_NAMES.PUBLISH_VIDEO) {
      return processPublishVideo(job);
    }
    throw new Error(`Job desconhecido na fila publish: ${job.name}`);
  },
  { connection, concurrency: env.WORKER_CONCURRENCY },
);

const tokenRefreshWorker = new Worker(
  QUEUE_NAMES.TOKEN_REFRESH,
  async (job) => {
    if (job.name === JOB_NAMES.REFRESH_TOKEN || job.name === 'refresh-token') {
      return processTokenRefresh(job);
    }
    throw new Error(`Job desconhecido na fila token-refresh: ${job.name}`);
  },
  { connection, concurrency: 2 },
);

// Scheduler: sweep a cada 15 min para detectar tokens próximos de expirar
async function scheduleSweep(): Promise<void> {
  await tokenRefreshQueue.add(
    JOB_NAMES.REFRESH_TOKEN,
    { sweep: true },
    {
      repeat: { every: 15 * 60 * 1000 }, // 15 min
      removeOnComplete: true,
      removeOnFail: true,
    },
  );
}
void scheduleSweep();

const workers = [uploadWorker, publishWorker, tokenRefreshWorker];

for (const w of workers) {
  w.on('completed', (job) => logger.info({ jobId: job.id, name: job.name }, 'job completed'));
  w.on('failed', (job, err) =>
    logger.error({ jobId: job?.id, name: job?.name, err: err.message }, 'job failed'),
  );
}

logger.info({ concurrency: env.WORKER_CONCURRENCY }, 'Workers iniciados');

const shutdown = async (signal: string): Promise<void> => {
  logger.info({ signal }, 'Encerrando workers...');
  await Promise.all(workers.map((w) => w.close()));
  await tokenRefreshQueue.close();
  await connection.quit();
  process.exit(0);
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
