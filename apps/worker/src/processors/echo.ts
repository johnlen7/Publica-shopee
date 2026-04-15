import type { Job } from 'bullmq';
import { echoJobSchema, type EchoJobPayload } from '@publica/shared';
import { logger } from '../logger.js';

export async function processEcho(job: Job<EchoJobPayload>): Promise<{ echoed: string }> {
  const data = echoJobSchema.parse(job.data);
  logger.info({ jobId: job.id, name: job.name, data }, 'echo job processing');
  return { echoed: data.message };
}
