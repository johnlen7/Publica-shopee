import type { Job } from 'bullmq';
import { logger } from '../logger.js';

/**
 * Publicação em Shopee Video — CONDICIONADA À FASE 2.
 *
 * Depende do gate de descoberta técnica (PLAN.md §"Descoberta técnica").
 * Se o endpoint oficial não for confirmado, este worker deve marcar o
 * PublishJob como PENDING_PUBLISH_API em vez de FAILED.
 */
export async function processPublishVideo(job: Job): Promise<never> {
  logger.warn(
    { jobId: job.id, name: job.name },
    'publish-video stub — depende de Fase 2 (gate de descoberta)',
  );
  throw new Error('publish-video: gate de descoberta técnica ainda não confirmado');
}
