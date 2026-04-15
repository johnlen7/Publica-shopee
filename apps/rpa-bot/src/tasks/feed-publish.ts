import path from 'node:path';
import fs from 'node:fs/promises';
import type { Page } from 'playwright';
import { SELLER_CENTER_URL, config } from '../config.js';
import { SELECTORS } from '../selectors.js';
import { humanDelay } from '../browser.js';
import { logger } from '../logger.js';
import type { RpaJobDto } from '../api-client.js';

/**
 * Publica um vídeo no feed Shopee Video via Seller Centre.
 *
 * ⚠️ Este é o fluxo NÃO-OFICIAL (ver AUDIT.md). Abre o Seller Centre,
 * navega até "Shopee Video", clica em criar, faz upload do arquivo
 * local, preenche caption/hashtags/agendamento e submete.
 *
 * Retorna um objeto com metadados úteis (screenshot final, URL, etc.)
 * que volta para a API via /rpa/jobs/:id/result.
 */

export interface FeedPublishResult {
  finalUrl: string;
  screenshotPath: string;
  scheduled: boolean;
}

export async function publishToShopeeVideo(
  page: Page,
  job: RpaJobDto,
): Promise<FeedPublishResult> {
  if (!job.videoLocalPath) throw new Error('Job sem videoLocalPath');
  const absVideoPath = path.isAbsolute(job.videoLocalPath)
    ? job.videoLocalPath
    : path.join(config.VIDEOS_ROOT, job.videoLocalPath);

  // Sanity check: arquivo existe?
  try {
    await fs.access(absVideoPath);
  } catch {
    throw new Error(`Arquivo não encontrado: ${absVideoPath}`);
  }

  logger.info({ jobId: job.id, path: absVideoPath }, 'abrindo Seller Centre');
  await page.goto(SELLER_CENTER_URL, { waitUntil: 'domcontentloaded' });
  await humanDelay(1000, 2000);

  // Se caiu no login, abortar com erro claro — seller precisa rodar `setup-login` antes
  if (await page.$(SELECTORS.loginForm)) {
    throw new Error('Sessão expirada — rode `pnpm setup-login` e refaça o login manualmente');
  }

  // Navegar para Shopee Video
  const videoLink = page.locator(SELECTORS.videoMenuEntry).first();
  await videoLink.waitFor({ state: 'visible', timeout: 15_000 });
  await humanDelay();
  await videoLink.click();

  // Entrar no fluxo de criação
  const createBtn = page.locator(SELECTORS.createVideoButton).first();
  await createBtn.waitFor({ state: 'visible', timeout: 15_000 });
  await humanDelay();
  await createBtn.click();

  // Upload do arquivo — tenta primeiro por fileChooser (mais resiliente),
  // faz fallback para input[type=file] direto.
  try {
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 10_000 }),
      page.locator(SELECTORS.uploadDropZone).first().click(),
    ]);
    await chooser.setFiles(absVideoPath);
  } catch {
    logger.warn('fileChooser não disparou, tentando input[type=file] direto');
    const input = page.locator(SELECTORS.fileInput).first();
    await input.setInputFiles(absVideoPath);
  }

  // Aguardar upload processar (até 5 min para arquivos médios)
  await waitForUploadComplete(page);

  // Caption
  await humanDelay();
  const captionField = page.locator(SELECTORS.captionField).first();
  await captionField.waitFor({ state: 'visible', timeout: 15_000 });
  await captionField.click();
  await typeHumanly(page, job.caption);

  // Hashtags — muitos editores aceitam hashtags no próprio textarea
  if (job.hashtags.length > 0) {
    await humanDelay();
    const hashtagText = ' ' + job.hashtags.map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ');
    await captionField.focus();
    await typeHumanly(page, hashtagText);
  }

  // Agendamento
  let scheduled = false;
  if (job.scheduledFor) {
    await humanDelay();
    const toggle = page.locator(SELECTORS.scheduleToggle).first();
    if (await toggle.count()) {
      await toggle.click();
      await humanDelay();
      const dateInput = page.locator(SELECTORS.datePickerInput).first();
      if (await dateInput.count()) {
        // Formato dd/mm/yyyy HH:mm no BR — ajuste conforme região
        const d = new Date(job.scheduledFor);
        const pad = (n: number): string => n.toString().padStart(2, '0');
        const dateStr = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(
          d.getHours(),
        )}:${pad(d.getMinutes())}`;
        await dateInput.fill(dateStr);
        await page.keyboard.press('Enter');
        scheduled = true;
      }
    }
  }

  // Publicar
  await humanDelay(600, 1500);
  const publishBtn = page.locator(SELECTORS.publishButton).first();
  await publishBtn.waitFor({ state: 'visible', timeout: 20_000 });
  await publishBtn.click();

  // Confirmar sucesso (toast) ou falhar
  const outcome = await Promise.race([
    page
      .locator(SELECTORS.successToast)
      .first()
      .waitFor({ state: 'visible', timeout: 60_000 })
      .then(() => 'success' as const),
    page
      .locator(SELECTORS.errorToast)
      .first()
      .waitFor({ state: 'visible', timeout: 60_000 })
      .then(() => 'error' as const),
  ]).catch(() => 'timeout' as const);

  const screenshotPath = `/tmp/rpa_${job.id}_${Date.now()}.png`;
  await page.screenshot({ path: screenshotPath, fullPage: false });

  if (outcome === 'error') throw new Error('Seller Centre retornou erro visível na UI');
  if (outcome === 'timeout') throw new Error('Timeout aguardando confirmação de publicação');

  return {
    finalUrl: page.url(),
    screenshotPath,
    scheduled,
  };
}

async function waitForUploadComplete(page: Page): Promise<void> {
  // Se existir uma barra de progresso, aguarda sumir
  const progress = page.locator(SELECTORS.progressIndicator).first();
  const visible = await progress.isVisible().catch(() => false);
  if (visible) {
    await progress.waitFor({ state: 'hidden', timeout: 5 * 60_000 });
  }
  // Pequena folga para o editor renderizar campos
  await humanDelay(1000, 2000);
}

/**
 * Digita texto com atraso curto por char (~50-120 ms) para evitar
 * padrão de colagem instantânea. Ainda assim detectável — é só um
 * mitigador, não uma solução.
 */
async function typeHumanly(page: Page, text: string): Promise<void> {
  for (const ch of text) {
    await page.keyboard.type(ch, { delay: 40 + Math.random() * 80 });
  }
}
