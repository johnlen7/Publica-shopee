import { chromium, type BrowserContext } from 'playwright';
import fs from 'node:fs/promises';
import { config } from './config.js';
import { logger } from './logger.js';

/**
 * Cria (ou reusa) um BrowserContext persistente.
 *
 * Ponto-chave: o seller loga UMA VEZ manualmente via `pnpm setup-login`.
 * A sessão (cookies, localStorage, indexed-db) fica salva em
 * config.USER_DATA_DIR — a partir daí, o agent reabre autenticado.
 *
 * headless: false por padrão (operador vê o que o robô está fazendo).
 * Ao rodar em servidor dedicado, pode ser ligado para true, mas isso
 * aumenta a taxa de detecção de automação.
 */

let context: BrowserContext | null = null;

export async function getBrowserContext(): Promise<BrowserContext> {
  if (context) return context;

  await fs.mkdir(config.USER_DATA_DIR, { recursive: true });

  logger.info({ userDataDir: config.USER_DATA_DIR }, 'abrindo browser persistente');

  context = await chromium.launchPersistentContext(config.USER_DATA_DIR, {
    headless: config.HEADLESS === 'true',
    viewport: { width: 1280, height: 800 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    // args "menos detectáveis" — nota: Shopee pode detectar mesmo assim
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-default-browser-check',
    ],
    // User agent padrão do Chrome recente (ajuste conforme sua versão)
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });

  // Remove marker webdriver básico
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  return context;
}

export async function closeBrowser(): Promise<void> {
  if (context) {
    await context.close();
    context = null;
  }
}

/**
 * Sleep com jitter humano (300–1200 ms por padrão).
 * Use entre ações para reduzir padrões rítmicos óbvios.
 */
export function humanDelay(min = 300, max = 1200): Promise<void> {
  const ms = Math.floor(min + Math.random() * (max - min));
  return new Promise((r) => setTimeout(r, ms));
}
