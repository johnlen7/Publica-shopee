import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { JOB_NAMES, schedulePublishSchema } from '@publica/shared';
import { prisma } from '../prisma.js';
import { publishQueue } from '../queues.js';
import { getAuth, requireRole } from '../plugins/rbac.js';

export async function scheduleRoutes(app: FastifyInstance): Promise<void> {
  // Listar jobs
  app.get('/schedule', { onRequest: [app.authenticate] }, async (request) => {
    const auth = getAuth(request);
    const jobs = await prisma.publishJob.findMany({
      where: { video: { workspaceId: auth.workspaceId } },
      orderBy: { scheduledFor: 'asc' },
      include: {
        video: { include: { metadata: true } },
        shopeeAccount: { select: { id: true, shopId: true, status: true } },
      },
    });
    return jobs.map((j) => ({
      ...j,
      video: j.video
        ? { ...j.video, fileSizeBytes: j.video.fileSizeBytes.toString() }
        : j.video,
    }));
  });

  // Criar job individual
  app.post(
    '/schedule',
    { onRequest: [app.authenticate, requireRole('OWNER', 'ADMIN', 'OPERATOR')] },
    async (request, reply) => {
      const auth = getAuth(request);
      const body = schedulePublishSchema.parse(request.body);

      // Guards do PRD §6.4: vídeo deve existir, conta deve pertencer ao workspace,
      // e upload precisa estar concluído.
      const [video, account] = await Promise.all([
        prisma.video.findFirst({
          where: { id: body.videoId, workspaceId: auth.workspaceId },
          include: { uploads: { orderBy: { createdAt: 'desc' }, take: 1 } },
        }),
        prisma.shopeeAccount.findFirst({
          where: { id: body.shopeeAccountId, workspaceId: auth.workspaceId },
        }),
      ]);

      if (!video) return reply.code(404).send({ message: 'Vídeo não encontrado' });
      if (!account) return reply.code(404).send({ message: 'Conta Shopee não encontrada' });
      if (account.status !== 'ACTIVE') {
        return reply.code(400).send({ message: `Conta Shopee com status ${account.status}` });
      }
      const lastUpload = video.uploads[0];
      if (!lastUpload || lastUpload.transcodingStatus !== 'SUCCEEDED') {
        return reply.code(400).send({
          message: 'Vídeo precisa ter upload concluído (transcodingStatus=SUCCEEDED) antes de agendar',
        });
      }

      const scheduledFor = new Date(body.scheduledFor);
      if (scheduledFor.getTime() <= Date.now()) {
        return reply.code(400).send({ message: 'scheduledFor deve ser futuro' });
      }

      const job = await prisma.publishJob.create({
        data: {
          videoId: body.videoId,
          shopeeAccountId: body.shopeeAccountId,
          scheduledFor,
          timezone: body.timezone,
          createdById: auth.sub,
          status: 'SCHEDULED',
        },
      });

      await publishQueue.add(
        JOB_NAMES.PUBLISH_VIDEO,
        { publishJobId: job.id },
        {
          delay: scheduledFor.getTime() - Date.now(),
          jobId: job.id,
          attempts: 5,
          backoff: { type: 'exponential', delay: 30_000 },
          removeOnComplete: { age: 30 * 24 * 3600, count: 1000 },
          removeOnFail: { age: 30 * 24 * 3600 },
        },
      );

      return reply.code(201).send(job);
    },
  );

  // Cancelar
  app.post(
    '/schedule/:id/cancel',
    { onRequest: [app.authenticate, requireRole('OWNER', 'ADMIN', 'OPERATOR')] },
    async (request, reply) => {
      const auth = getAuth(request);
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

      const job = await prisma.publishJob.findFirst({
        where: { id, video: { workspaceId: auth.workspaceId } },
      });
      if (!job) return reply.code(404).send({ message: 'Job não encontrado' });
      if (job.status === 'COMPLETED') {
        return reply.code(400).send({ message: 'Job já concluído' });
      }

      const queued = await publishQueue.getJob(id);
      if (queued) await queued.remove();

      const updated = await prisma.publishJob.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
      await prisma.auditLog.create({
        data: {
          workspaceId: auth.workspaceId,
          actorId: auth.sub,
          entityType: 'PublishJob',
          entityId: id,
          action: 'CANCEL',
        },
      });
      return updated;
    },
  );
}
