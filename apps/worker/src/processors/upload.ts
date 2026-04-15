import type { Job } from 'bullmq';
import { logger } from '../logger.js';

/**
 * Esqueleto do pipeline de upload oficial Shopee (PRD §6.2, §5.2).
 *
 * Fluxo completo a ser implementado na Fase 1:
 *   1. init_video_upload  -> recebe video_upload_id
 *   2. upload_video_part  -> envia partes de 4 MB (exceto última)
 *   3. complete_video_upload
 *   4. get_video_upload_result (polling até estado terminal)
 *
 * Esta stub apenas registra o job e lança erro explícito ("not implemented")
 * para deixar claro que ainda não há integração real com a Shopee.
 */
export async function processInitUpload(job: Job): Promise<never> {
  logger.warn({ jobId: job.id, name: job.name }, 'init-upload stub — Fase 1 pendente');
  throw new Error('init-upload: Fase 1 ainda não implementada');
}

export async function processUploadPart(job: Job): Promise<never> {
  logger.warn({ jobId: job.id, name: job.name }, 'upload-part stub — Fase 1 pendente');
  throw new Error('upload-part: Fase 1 ainda não implementada');
}

export async function processCompleteUpload(job: Job): Promise<never> {
  logger.warn({ jobId: job.id, name: job.name }, 'complete-upload stub — Fase 1 pendente');
  throw new Error('complete-upload: Fase 1 ainda não implementada');
}

export async function processPollTranscoding(job: Job): Promise<never> {
  logger.warn({ jobId: job.id, name: job.name }, 'poll-transcoding stub — Fase 1 pendente');
  throw new Error('poll-transcoding: Fase 1 ainda não implementada');
}
