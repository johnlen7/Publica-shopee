import type { Job } from 'bullmq';
import { logger } from '../logger.js';

/**
 * Renovação automática de access_token Shopee via refresh_token.
 * Implementação completa faz parte da Fase 1 §1.1 (PLAN.md).
 */
export async function processTokenRefresh(job: Job): Promise<never> {
  logger.warn({ jobId: job.id, name: job.name }, 'token-refresh stub — Fase 1 pendente');
  throw new Error('token-refresh: Fase 1 ainda não implementada');
}
