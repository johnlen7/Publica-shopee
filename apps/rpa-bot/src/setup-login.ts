import { SELLER_CENTER_URL } from './config.js';
import { getBrowserContext, closeBrowser } from './browser.js';
import { logger } from './logger.js';

/**
 * Setup inicial — abre o Seller Centre e aguarda o operador fazer
 * login manualmente. A sessão fica persistida em USER_DATA_DIR e o
 * agent reaproveita nas próximas execuções.
 *
 * Uso: `pnpm setup-login`
 */

async function main(): Promise<void> {
  const ctx = await getBrowserContext();
  const page = await ctx.newPage();

  logger.info('Abrindo Seller Centre. Faça login manualmente e pressione ENTER quando terminar.');
  await page.goto(SELLER_CENTER_URL, { waitUntil: 'domcontentloaded' });

  // Aguarda operador pressionar ENTER no terminal
  await new Promise<void>((resolve) => {
    process.stdin.setRawMode?.(true);
    process.stdin.resume();
    process.stdin.once('data', () => resolve());
  });

  logger.info('Sessão salva. Feche o browser quando quiser.');
  await closeBrowser();
  process.exit(0);
}

main().catch((err: unknown) => {
  logger.error({ err: String(err) }, 'setup-login falhou');
  process.exit(1);
});
