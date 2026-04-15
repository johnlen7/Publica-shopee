import type { Job } from 'bullmq';
import {
  cancelVideoUpload,
  completeVideoUpload,
  getVideoUploadResult,
  initVideoUpload,
  uploadVideoPart,
  ShopeeApiError,
} from '@publica/shopee';
import { decryptToken, prisma } from '@publica/db';
import { logger } from '../logger.js';
import { md5Hex, readStaged, splitIntoParts } from '../storage.js';
import { getShopeeConfig } from '../shopee-config.js';
import { uploadQueue } from '../queues.js';

/**
 * Pipeline completo de upload via media_space.
 *
 * Entrada: { videoUploadDbId: string } — ID do VideoUpload em nosso banco.
 *
 * Passos:
 *   1. Carregar VideoUpload + Video + ShopeeAccount (com tokens descriptografados)
 *   2. Ler arquivo do staging
 *   3. init_video_upload (com file_md5 + file_size)
 *   4. upload_video_part para cada parte de 4 MB
 *   5. complete_video_upload (part_seq_list + report_data)
 *   6. Reenfileirar poll-transcoding (backoff 5s → 10s → 20s, cap 2 min)
 */

interface InitUploadPayload {
  videoUploadDbId: string;
}

export async function processInitUpload(job: Job<InitUploadPayload>): Promise<void> {
  const { videoUploadDbId } = job.data;

  const upload = await prisma.videoUpload.findUnique({
    where: { id: videoUploadDbId },
    include: { video: true, shopeeAccount: true },
  });

  if (!upload || !upload.video || !upload.shopeeAccount) {
    throw new Error(`VideoUpload ${videoUploadDbId} não encontrado`);
  }
  if (!upload.video.localStoragePath) {
    throw new Error('Video sem localStoragePath — arquivo não está no staging');
  }
  if (!upload.shopeeAccount.shopId) {
    throw new Error('ShopeeAccount sem shop_id (CBSC merchant ainda não suportado no upload)');
  }

  const uploadStart = Date.now();
  const fileBuffer = await readStaged(upload.video.localStoragePath);
  const fileMd5 = md5Hex(fileBuffer);
  const fileSize = fileBuffer.length;

  const accessToken = decryptToken(upload.shopeeAccount.accessTokenEncrypted);
  const config = getShopeeConfig();
  const authCtx = {
    config,
    accessToken,
    shopId: upload.shopeeAccount.shopId,
  };

  logger.info({ jobId: job.id, uploadId: upload.id, fileSize }, 'init_video_upload');

  await prisma.videoUpload.update({
    where: { id: upload.id },
    data: { uploadStatus: 'INITIATED' },
  });

  const init = await initVideoUpload({ ...authCtx, fileMd5, fileSize });

  await prisma.videoUpload.update({
    where: { id: upload.id },
    data: {
      shopeeVideoUploadId: init.video_upload_id,
      uploadStatus: 'UPLOADING',
    },
  });

  // Envio sequencial das partes
  const parts = splitIntoParts(fileBuffer);
  for (const p of parts) {
    logger.debug({ jobId: job.id, partSeq: p.seq, size: p.buffer.length }, 'upload_video_part');
    await uploadVideoPart({
      ...authCtx,
      videoUploadId: init.video_upload_id,
      partSeq: p.seq,
      contentMd5: p.md5,
      part: p.buffer,
    });
    await job.updateProgress(Math.round(((p.seq + 1) / parts.length) * 80));
  }

  logger.info({ jobId: job.id, uploadId: upload.id }, 'complete_video_upload');

  await completeVideoUpload({
    ...authCtx,
    videoUploadId: init.video_upload_id,
    partSeqList: parts.map((p) => p.seq),
    reportData: {
      upload_cost: Date.now() - uploadStart,
      upload_size: fileSize,
      client_network_type: 'server-to-server',
    },
  });

  await prisma.videoUpload.update({
    where: { id: upload.id },
    data: {
      uploadStatus: 'COMPLETED',
      transcodingStatus: 'TRANSCODING',
    },
  });

  // Enfileira o polling
  await uploadQueue.add(
    'poll-transcoding',
    { videoUploadDbId: upload.id, attempt: 1 },
    {
      delay: 5_000,
      jobId: `poll_${upload.id}_1`,
      attempts: 1,
      removeOnComplete: true,
    },
  );
}

interface PollPayload {
  videoUploadDbId: string;
  attempt: number;
}

const POLL_BACKOFFS_MS = [5_000, 10_000, 20_000, 30_000, 60_000, 120_000];
const POLL_MAX_ATTEMPTS = 40; // ~40 min total no pior caso

export async function processPollTranscoding(job: Job<PollPayload>): Promise<void> {
  const { videoUploadDbId, attempt } = job.data;

  const upload = await prisma.videoUpload.findUnique({
    where: { id: videoUploadDbId },
    include: { shopeeAccount: true },
  });
  if (!upload || !upload.shopeeVideoUploadId || !upload.shopeeAccount?.shopId) {
    throw new Error(`Upload ${videoUploadDbId} em estado inválido para polling`);
  }
  if (upload.transcodingStatus === 'SUCCEEDED' || upload.transcodingStatus === 'FAILED') {
    return; // já finalizado por outro caminho
  }

  const accessToken = decryptToken(upload.shopeeAccount.accessTokenEncrypted);
  const config = getShopeeConfig();

  let result;
  try {
    result = await getVideoUploadResult({
      config,
      accessToken,
      shopId: upload.shopeeAccount.shopId,
      videoUploadId: upload.shopeeVideoUploadId,
    });
  } catch (err: unknown) {
    if (err instanceof ShopeeApiError) {
      logger.warn({ code: err.code, message: err.message }, 'poll falhou temporariamente');
    } else {
      throw err;
    }
    await reenqueuePoll(job, upload.id, attempt);
    return;
  }

  logger.info({ jobId: job.id, status: result.status, attempt }, 'poll_result');

  if (result.status === 'SUCCEEDED') {
    const remoteVideo = result.video_info?.video_url_list?.[0]?.resource_url;
    const remoteThumb = result.video_info?.thumbnail_url_list?.[0]?.resource_url;
    await prisma.videoUpload.update({
      where: { id: upload.id },
      data: {
        transcodingStatus: 'SUCCEEDED',
        remoteVideoUrl: remoteVideo,
        remoteThumbnailUrl: remoteThumb,
        finishedAt: new Date(),
      },
    });
    return;
  }
  if (result.status === 'FAILED' || result.status === 'CANCELLED') {
    await prisma.videoUpload.update({
      where: { id: upload.id },
      data: {
        transcodingStatus: 'FAILED',
        failureReason: result.message ?? `Shopee retornou ${result.status}`,
        finishedAt: new Date(),
      },
    });
    return;
  }

  // Ainda transcodificando → reenfileira
  await reenqueuePoll(job, upload.id, attempt);
}

async function reenqueuePoll(_job: Job, uploadId: string, attempt: number): Promise<void> {
  if (attempt >= POLL_MAX_ATTEMPTS) {
    await prisma.videoUpload.update({
      where: { id: uploadId },
      data: {
        transcodingStatus: 'FAILED',
        failureReason: `Timeout no polling após ${attempt} tentativas`,
        finishedAt: new Date(),
      },
    });
    return;
  }
  const delay = POLL_BACKOFFS_MS[Math.min(attempt, POLL_BACKOFFS_MS.length - 1)];
  await uploadQueue.add(
    'poll-transcoding',
    { videoUploadDbId: uploadId, attempt: attempt + 1 },
    {
      delay,
      jobId: `poll_${uploadId}_${attempt + 1}`,
      attempts: 1,
      removeOnComplete: true,
    },
  );
}

interface CancelPayload {
  videoUploadDbId: string;
}

export async function processCancelUpload(job: Job<CancelPayload>): Promise<void> {
  const { videoUploadDbId } = job.data;
  const upload = await prisma.videoUpload.findUnique({
    where: { id: videoUploadDbId },
    include: { shopeeAccount: true },
  });
  if (!upload || !upload.shopeeVideoUploadId || !upload.shopeeAccount?.shopId) {
    return;
  }
  const accessToken = decryptToken(upload.shopeeAccount.accessTokenEncrypted);
  const config = getShopeeConfig();

  try {
    await cancelVideoUpload({
      config,
      accessToken,
      shopId: upload.shopeeAccount.shopId,
      videoUploadId: upload.shopeeVideoUploadId,
    });
  } catch (err: unknown) {
    logger.warn({ jobId: job.id, err: String(err) }, 'cancel_video_upload falhou (ignorando)');
  }
}

// Stubs mantidos para compatibilidade do switch do worker
export async function processUploadPart(_job: Job): Promise<never> {
  throw new Error('upload-part não é chamado diretamente — embutido em init-upload');
}

export async function processCompleteUpload(_job: Job): Promise<never> {
  throw new Error('complete-upload não é chamado diretamente — embutido em init-upload');
}
