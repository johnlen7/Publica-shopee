import type { Job } from 'bullmq';
import { updateItemVideo, ShopeeApiError } from '@publica/shopee';
import { decryptToken, prisma } from '@publica/db';
import { logger } from '../logger.js';
import { getShopeeConfig } from '../shopee-config.js';

/**
 * Aplicação agendada do vídeo ao produto (vinculação) via
 * /api/v2/product/update_item — ver AUDIT.md §3.
 *
 * O payload contém apenas `publishJobId`. Todos os demais dados são
 * carregados do banco: o vídeo, a conta Shopee, e o upload concluído.
 *
 * Observação de produto: não existe publicação no feed "Shopee Video".
 * Este worker executa a única via oficial: aplicar o vídeo carregado a
 * um item de listing existente do seller.
 */

interface PublishPayload {
  publishJobId: string;
  itemId?: number; // opcional — se não vier no payload, busca em metadata
}

export async function processPublishVideo(job: Job<PublishPayload>): Promise<void> {
  const { publishJobId, itemId } = job.data;

  const publishJob = await prisma.publishJob.findUnique({
    where: { id: publishJobId },
    include: {
      video: {
        include: {
          uploads: {
            where: { transcodingStatus: 'SUCCEEDED' },
            orderBy: { finishedAt: 'desc' },
            take: 1,
          },
          metadata: true,
        },
      },
      shopeeAccount: true,
    },
  });

  if (!publishJob) throw new Error(`PublishJob ${publishJobId} não encontrado`);
  if (publishJob.status === 'CANCELLED' || publishJob.status === 'COMPLETED') {
    return;
  }

  const upload = publishJob.video.uploads[0];
  if (!upload?.shopeeVideoUploadId) {
    await markFailed(publishJobId, 'Vídeo sem upload com transcodificação concluída');
    return;
  }
  if (!publishJob.shopeeAccount?.shopId) {
    await markFailed(publishJobId, 'Conta Shopee sem shop_id (CBSC ainda não suportado)');
    return;
  }

  // item_id precisa ser informado. Pode vir do payload do job OU do campo
  // 'category' do metadata (convenção: metadata.category guarda item_id
  // quando o caminho é update_item). Em futuros incrementos, adicionar
  // coluna dedicada `productItemId` na tabela PublishJob.
  const targetItemId = itemId ?? parseItemId(publishJob.video.metadata?.category);
  if (!targetItemId) {
    await markFailed(publishJobId, 'item_id (produto) não informado no job');
    return;
  }

  await prisma.publishJob.update({
    where: { id: publishJobId },
    data: { status: 'RUNNING' },
  });

  const accessToken = decryptToken(publishJob.shopeeAccount.accessTokenEncrypted);
  const config = getShopeeConfig();

  try {
    const result = await updateItemVideo({
      config,
      accessToken,
      shopId: publishJob.shopeeAccount.shopId,
      itemId: targetItemId,
      videoUploadId: upload.shopeeVideoUploadId,
      title: publishJob.video.metadata?.title,
      description: publishJob.video.metadata?.description ?? undefined,
    });

    await prisma.$transaction(async (tx) => {
      await tx.publishJob.update({
        where: { id: publishJobId },
        data: { status: 'COMPLETED', lastError: null },
      });
      await tx.auditLog.create({
        data: {
          workspaceId: publishJob.shopeeAccount!.workspaceId,
          entityType: 'PublishJob',
          entityId: publishJobId,
          action: 'PUBLISH_COMPLETED',
          payload: { itemId: result.item_id, updateTime: result.update_time },
        },
      });
    });
    logger.info({ jobId: job.id, itemId: result.item_id }, 'publish COMPLETED');
  } catch (err: unknown) {
    const message = err instanceof ShopeeApiError ? `${err.code}: ${err.message}` : String(err);
    logger.error({ jobId: job.id, err: message }, 'publish failed');
    await prisma.publishJob.update({
      where: { id: publishJobId },
      data: {
        status: 'FAILED',
        lastError: message,
        retriesCount: { increment: 1 },
      },
    });
    throw err; // deixa o BullMQ reagendar conforme backoff configurado
  }
}

function parseItemId(input: string | null | undefined): number | null {
  if (!input) return null;
  const n = Number(input);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function markFailed(id: string, reason: string): Promise<void> {
  await prisma.publishJob.update({
    where: { id },
    data: { status: 'FAILED', lastError: reason },
  });
}
