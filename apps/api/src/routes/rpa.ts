import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { getAuth, requireRole } from '../plugins/rbac.js';

/**
 * Rotas do módulo RPA — trilha NÃO-OFICIAL via Playwright.
 *
 * ⚠️ Toda ação deste módulo é registrada em audit_logs com action
 * prefixado por "RPA_" e payload contendo notice_version aceita pelo
 * workspace. Sem consentimento, 403.
 *
 * Ver AUDIT.md "Anexo — Trilha não-oficial (RPA)".
 */

export const RPA_NOTICE_VERSION = '2026-04-v1';

const consentInputSchema = z.object({
  noticeVersion: z.literal(RPA_NOTICE_VERSION),
  confirmations: z.object({
    understandsTosRisk: z.literal(true),
    acceptsDetectionRisk: z.literal(true),
    runsLocallyOnOwnMachine: z.literal(true),
  }),
});

const createJobSchema = z.object({
  videoLocalPath: z.string().min(1),
  caption: z.string().min(1).max(2000),
  hashtags: z.array(z.string().max(60)).max(30).default([]),
  scheduledFor: z.string().datetime().optional(),
});

const claimSchema = z.object({
  agentId: z.string().min(1),
});

const resultSchema = z.object({
  status: z.enum(['COMPLETED', 'FAILED']),
  lastError: z.string().optional(),
  result: z.record(z.unknown()).optional(),
});

async function ensureConsent(workspaceId: string): Promise<boolean> {
  const c = await prisma.rpaConsent.findUnique({ where: { workspaceId } });
  return Boolean(c && c.noticeVersion === RPA_NOTICE_VERSION);
}

export async function rpaRoutes(app: FastifyInstance): Promise<void> {
  // GET estado do consentimento
  app.get('/rpa/consent', { onRequest: [app.authenticate] }, async (request) => {
    const auth = getAuth(request);
    const c = await prisma.rpaConsent.findUnique({
      where: { workspaceId: auth.workspaceId },
    });
    return {
      accepted: Boolean(c && c.noticeVersion === RPA_NOTICE_VERSION),
      noticeVersion: RPA_NOTICE_VERSION,
      acceptedAt: c?.acceptedAt ?? null,
    };
  });

  // POST aceitar o aviso (só OWNER/ADMIN)
  app.post(
    '/rpa/consent',
    { onRequest: [app.authenticate, requireRole('OWNER', 'ADMIN')] },
    async (request, reply) => {
      const auth = getAuth(request);
      const body = consentInputSchema.parse(request.body);

      const consent = await prisma.rpaConsent.upsert({
        where: { workspaceId: auth.workspaceId },
        update: {
          acceptedById: auth.sub,
          acceptedAt: new Date(),
          noticeVersion: body.noticeVersion,
        },
        create: {
          workspaceId: auth.workspaceId,
          acceptedById: auth.sub,
          noticeVersion: body.noticeVersion,
        },
      });
      await prisma.auditLog.create({
        data: {
          workspaceId: auth.workspaceId,
          actorId: auth.sub,
          entityType: 'RpaConsent',
          entityId: consent.id,
          action: 'RPA_CONSENT_ACCEPTED',
          payload: { noticeVersion: body.noticeVersion, confirmations: body.confirmations },
        },
      });
      return reply.code(201).send(consent);
    },
  );

  // GET jobs do workspace
  app.get('/rpa/jobs', { onRequest: [app.authenticate] }, async (request) => {
    const auth = getAuth(request);
    return prisma.rpaJob.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  });

  // POST criar job
  app.post(
    '/rpa/jobs',
    { onRequest: [app.authenticate, requireRole('OWNER', 'ADMIN', 'OPERATOR')] },
    async (request, reply) => {
      const auth = getAuth(request);
      if (!(await ensureConsent(auth.workspaceId))) {
        return reply.code(403).send({
          message: 'RPA desabilitado — é necessário aceitar o aviso em /rpa/consent',
          noticeVersion: RPA_NOTICE_VERSION,
        });
      }
      const body = createJobSchema.parse(request.body);
      const job = await prisma.rpaJob.create({
        data: {
          workspaceId: auth.workspaceId,
          videoLocalPath: body.videoLocalPath,
          caption: body.caption,
          hashtags: body.hashtags,
          scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
          createdById: auth.sub,
          status: 'PENDING',
        },
      });
      await prisma.auditLog.create({
        data: {
          workspaceId: auth.workspaceId,
          actorId: auth.sub,
          entityType: 'RpaJob',
          entityId: job.id,
          action: 'RPA_JOB_CREATED',
          payload: { uses_unofficial_automation: true },
        },
      });
      return reply.code(201).send(job);
    },
  );

  // Cancelar job (antes do claim ou durante)
  app.post(
    '/rpa/jobs/:id/cancel',
    { onRequest: [app.authenticate, requireRole('OWNER', 'ADMIN', 'OPERATOR')] },
    async (request, reply) => {
      const auth = getAuth(request);
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

      const job = await prisma.rpaJob.findFirst({
        where: { id, workspaceId: auth.workspaceId },
      });
      if (!job) return reply.code(404).send({ message: 'Job não encontrado' });
      if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status)) {
        return reply.code(400).send({ message: `Job já está em ${job.status}` });
      }

      const updated = await prisma.rpaJob.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
      await prisma.auditLog.create({
        data: {
          workspaceId: auth.workspaceId,
          actorId: auth.sub,
          entityType: 'RpaJob',
          entityId: id,
          action: 'RPA_JOB_CANCELLED',
        },
      });
      return updated;
    },
  );

  // --- Endpoints consumidos pelo AGENTE LOCAL ----------------------------
  //
  // Autenticação: o agente usa um JWT regular do workspace (gerado uma
  // vez pelo operador no setup do bot). Nenhum endpoint aqui aceita
  // credenciais sem JWT válido.

  // Claim: agente reivindica até 1 job pendente.
  app.post(
    '/rpa/jobs/claim',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const auth = getAuth(request);
      if (!(await ensureConsent(auth.workspaceId))) {
        return reply.code(403).send({ message: 'RPA desabilitado neste workspace' });
      }
      const { agentId } = claimSchema.parse(request.body);

      // Seleciona candidato em transação para evitar corrida entre agentes
      const job = await prisma.$transaction(async (tx) => {
        const candidate = await tx.rpaJob.findFirst({
          where: {
            workspaceId: auth.workspaceId,
            status: 'PENDING',
            OR: [{ scheduledFor: null }, { scheduledFor: { lte: new Date() } }],
          },
          orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'asc' }],
        });
        if (!candidate) return null;
        return tx.rpaJob.update({
          where: { id: candidate.id },
          data: {
            status: 'CLAIMED',
            claimedBy: agentId,
            claimedAt: new Date(),
          },
        });
      });

      if (!job) return reply.code(204).send();
      return reply.code(200).send(job);
    },
  );

  // Heartbeat / transição RUNNING
  app.post(
    '/rpa/jobs/:id/start',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const auth = getAuth(request);
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const job = await prisma.rpaJob.findFirst({
        where: { id, workspaceId: auth.workspaceId, status: 'CLAIMED' },
      });
      if (!job) return reply.code(404).send({ message: 'Job não encontrado ou não CLAIMED' });
      return prisma.rpaJob.update({
        where: { id },
        data: { status: 'RUNNING', startedAt: new Date() },
      });
    },
  );

  // Resultado final
  app.post(
    '/rpa/jobs/:id/result',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const auth = getAuth(request);
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = resultSchema.parse(request.body);

      const job = await prisma.rpaJob.findFirst({
        where: { id, workspaceId: auth.workspaceId },
      });
      if (!job) return reply.code(404).send({ message: 'Job não encontrado' });

      const updated = await prisma.rpaJob.update({
        where: { id },
        data: {
          status: body.status,
          lastError: body.lastError ?? null,
          result: body.result as object | undefined,
          finishedAt: new Date(),
          retriesCount: body.status === 'FAILED' ? { increment: 1 } : undefined,
        },
      });

      await prisma.auditLog.create({
        data: {
          workspaceId: auth.workspaceId,
          actorId: auth.sub,
          entityType: 'RpaJob',
          entityId: id,
          action: body.status === 'COMPLETED' ? 'RPA_JOB_COMPLETED' : 'RPA_JOB_FAILED',
          payload: {
            uses_unofficial_automation: true,
            lastError: body.lastError ?? null,
          },
        },
      });

      return updated;
    },
  );
}
