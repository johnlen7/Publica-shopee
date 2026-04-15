import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildAuthorizationUrl, exchangeCodeForToken } from '@publica/shopee';
import { prisma } from '../prisma.js';
import { getAuth, requireRole } from '../plugins/rbac.js';
import { encryptToken } from '../crypto.js';
import { getShopeeConfig } from '../shopee-config.js';

export async function integrationRoutes(app: FastifyInstance): Promise<void> {
  // Listar contas conectadas (sem tokens, nunca)
  app.get('/integrations/shopee', { onRequest: [app.authenticate] }, async (request) => {
    const auth = getAuth(request);
    const accounts = await prisma.shopeeAccount.findMany({
      where: { workspaceId: auth.workspaceId },
      select: {
        id: true,
        shopId: true,
        merchantId: true,
        status: true,
        tokenExpiresAt: true,
        lastRefreshedAt: true,
        connectedAt: true,
      },
      orderBy: { connectedAt: 'desc' },
    });
    return accounts;
  });

  // Iniciar fluxo: devolve URL de autorização oficial
  app.post(
    '/integrations/shopee/authorize',
    { onRequest: [app.authenticate, requireRole('OWNER', 'ADMIN')] },
    async (request, reply) => {
      const auth = getAuth(request);
      const cfg = getShopeeConfig();
      if (!cfg) {
        return reply
          .code(503)
          .send({ message: 'Integração Shopee não configurada (SHOPEE_PARTNER_ID ausente)' });
      }
      const state = Buffer.from(JSON.stringify({ workspaceId: auth.workspaceId })).toString(
        'base64url',
      );
      return { authorizationUrl: buildAuthorizationUrl(cfg, { state }) };
    },
  );

  // Callback OAuth (Shopee redireciona aqui com code + shop_id)
  app.get('/integrations/shopee/callback', async (request, reply) => {
    const q = z
      .object({
        code: z.string(),
        shop_id: z.string().optional(),
        main_account_id: z.string().optional(),
        state: z.string().optional(),
      })
      .parse(request.query);

    const state = q.state ? JSON.parse(Buffer.from(q.state, 'base64url').toString('utf8')) : {};
    const workspaceId = state.workspaceId as string | undefined;
    if (!workspaceId) {
      return reply.code(400).send({ message: 'state inválido' });
    }

    try {
      const cfg = getShopeeConfig();
      if (!cfg) throw new Error('Shopee não configurada');
      const token = await exchangeCodeForToken(cfg, {
        code: q.code,
        shopId: q.shop_id,
        merchantId: q.main_account_id,
      });

      const expiresAt = new Date(Date.now() + token.expireIn * 1000);

      await prisma.shopeeAccount.create({
        data: {
          workspaceId,
          shopId: q.shop_id,
          merchantId: q.main_account_id,
          accessTokenEncrypted: encryptToken(token.accessToken),
          refreshTokenEncrypted: encryptToken(token.refreshToken),
          tokenExpiresAt: expiresAt,
          lastRefreshedAt: new Date(),
          status: 'ACTIVE',
        },
      });

      await prisma.auditLog.create({
        data: {
          workspaceId,
          entityType: 'ShopeeAccount',
          entityId: q.shop_id ?? q.main_account_id ?? 'unknown',
          action: 'CONNECT',
          payload: { shopId: q.shop_id, merchantId: q.main_account_id },
        },
      });

      // Redireciona para o frontend (rota de integrações) com sucesso
      return reply.redirect(
        `${process.env.WEB_URL ?? 'http://localhost:5173'}/integracoes?connected=1`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha no callback Shopee';
      request.log.error({ err: message }, 'Shopee callback failed');
      return reply.redirect(
        `${process.env.WEB_URL ?? 'http://localhost:5173'}/integracoes?error=${encodeURIComponent(
          message,
        )}`,
      );
    }
  });

  // Desconectar
  app.delete(
    '/integrations/shopee/:id',
    { onRequest: [app.authenticate, requireRole('OWNER', 'ADMIN')] },
    async (request, reply) => {
      const auth = getAuth(request);
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const existing = await prisma.shopeeAccount.findFirst({
        where: { id, workspaceId: auth.workspaceId },
      });
      if (!existing) return reply.code(404).send({ message: 'Conta não encontrada' });

      await prisma.shopeeAccount.update({
        where: { id },
        data: { status: 'REVOKED' },
      });
      await prisma.auditLog.create({
        data: {
          workspaceId: auth.workspaceId,
          actorId: auth.sub,
          entityType: 'ShopeeAccount',
          entityId: id,
          action: 'DISCONNECT',
        },
      });
      return reply.code(204).send();
    },
  );
}
