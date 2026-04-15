import type { Job } from 'bullmq';
import { refreshAccessToken } from '@publica/shopee';
import { decryptToken, encryptToken, prisma } from '@publica/db';
import { logger } from '../logger.js';
import { getShopeeConfig } from '../shopee-config.js';
import { tokenRefreshQueue } from '../queues.js';

/**
 * Renova tokens que estão próximos da expiração.
 *
 * Dois modos de invocação:
 *   1. Scheduled (repeat job) rodando a cada 15 min — varre contas ACTIVE
 *      com `tokenExpiresAt < now + 1h` e enfileira refresh individual.
 *   2. Direto: { shopeeAccountId } — refresh pontual, usado quando uma
 *      chamada recebeu `error_auth` e queremos tentar recuperar.
 *
 * Refresh token Shopee é rotativo: o anterior é invalidado. A persistência
 * é em transação atômica para evitar perda em caso de crash.
 */

interface RefreshPayload {
  shopeeAccountId?: string;
  sweep?: boolean;
}

export async function processTokenRefresh(job: Job<RefreshPayload>): Promise<void> {
  if (job.data.sweep) {
    const threshold = new Date(Date.now() + 60 * 60 * 1000); // 1h à frente
    const candidates = await prisma.shopeeAccount.findMany({
      where: {
        status: 'ACTIVE',
        tokenExpiresAt: { lt: threshold },
      },
      select: { id: true },
    });
    logger.info({ count: candidates.length }, 'token-refresh sweep');
    for (const c of candidates) {
      await tokenRefreshQueue.add(
        'refresh-token',
        { shopeeAccountId: c.id },
        { attempts: 3, backoff: { type: 'exponential', delay: 10_000 } },
      );
    }
    return;
  }

  const id = job.data.shopeeAccountId;
  if (!id) throw new Error('refresh-token: shopeeAccountId ausente');

  const account = await prisma.shopeeAccount.findUnique({ where: { id } });
  if (!account || account.status !== 'ACTIVE') {
    logger.info({ id }, 'refresh-token: conta não está ACTIVE, pulando');
    return;
  }

  const refreshToken = decryptToken(account.refreshTokenEncrypted);
  const config = getShopeeConfig();

  try {
    const newToken = await refreshAccessToken(config, {
      refreshToken,
      shopId: account.shopId ?? undefined,
      merchantId: account.merchantId ?? undefined,
    });

    await prisma.$transaction(async (tx) => {
      await tx.shopeeAccount.update({
        where: { id },
        data: {
          accessTokenEncrypted: encryptToken(newToken.accessToken),
          refreshTokenEncrypted: encryptToken(newToken.refreshToken),
          tokenExpiresAt: new Date(Date.now() + newToken.expireIn * 1000),
          lastRefreshedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          workspaceId: account.workspaceId,
          entityType: 'ShopeeAccount',
          entityId: id,
          action: 'TOKEN_REFRESH',
          payload: { expireIn: newToken.expireIn },
        },
      });
    });
    logger.info({ id }, 'token renovado com sucesso');
  } catch (err: unknown) {
    logger.error({ id, err: String(err) }, 'falha ao renovar token');
    await prisma.shopeeAccount.update({
      where: { id },
      data: { status: 'NEEDS_RECONNECT' },
    });
    throw err;
  }
}
