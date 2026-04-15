import { api } from './api-client.js';
import { closeBrowser, getBrowserContext } from './browser.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { publishToShopeeVideo } from './tasks/feed-publish.js';

/**
 * Loop principal do agente RPA.
 *
 * 1. Polling em /rpa/jobs/claim — pega no máximo 1 job por ciclo.
 * 2. Abre (ou reusa) BrowserContext persistente.
 * 3. Executa a tarefa correspondente.
 * 4. Reporta resultado em /rpa/jobs/:id/result.
 * 5. Espera POLL_INTERVAL_MS e recomeça.
 */

let running = true;

async function tick(): Promise<void> {
  const job = await api.claimJob(config.AGENT_ID);
  if (!job) return;

  logger.info({ jobId: job.id }, 'job reivindicado');
  await api.startJob(job.id);

  const ctx = await getBrowserContext();
  const page = ctx.pages()[0] ?? (await ctx.newPage());

  try {
    const result = await publishToShopeeVideo(page, job);
    await api.reportResult(job.id, {
      status: 'COMPLETED',
      result: result as unknown as Record<string, unknown>,
    });
    logger.info({ jobId: job.id, result }, 'job COMPLETED');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await api.reportResult(job.id, { status: 'FAILED', lastError: message });
    logger.error({ jobId: job.id, err: message }, 'job FAILED');
  }
}

async function main(): Promise<void> {
  logger.info({ agentId: config.AGENT_ID, apiUrl: config.API_URL }, 'RPA agent iniciado');

  while (running) {
    try {
      await tick();
    } catch (err: unknown) {
      logger.error({ err: String(err) }, 'erro inesperado no loop');
    }
    await sleep(config.POLL_INTERVAL_MS);
  }

  await closeBrowser();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const shutdown = async (signal: string): Promise<void> => {
  logger.info({ signal }, 'desligando agent...');
  running = false;
  setTimeout(() => process.exit(0), 5_000);
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

main().catch((err: unknown) => {
  logger.error({ err: String(err) }, 'crash fatal');
  process.exit(1);
});
