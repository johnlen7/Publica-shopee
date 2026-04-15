import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { JOB_NAMES } from '@publica/shared';
import { prisma } from '../prisma.js';
import { uploadQueue } from '../queues.js';
import { getAuth, requireRole } from '../plugins/rbac.js';

/**
 * Rotas para operar o pipeline de upload via media_space Shopee.
 * O arquivo binário é salvo em S3/MinIO pelo cliente via URL pré-assinada
 * (a implementação do staging está no próximo incremento).
 *
 * Este endpoint apenas:
 *   1. valida que o vídeo existe no workspace
 *   2. valida que a conta Shopee é do workspace
 *   3. enfileira o job init-upload no worker
 */

const startUploadSchema = z.object({
  videoId: z.string().uuid(),
  shopeeAccountId: z.string().uuid(),
  /** path relativo no bucket S3 onde o binário já foi enviado */
  storagePath: z.string().min(1),
});

export async function uploadRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/uploads',
    { onRequest: [app.authenticate, requireRole('OWNER', 'ADMIN', 'OPERATOR')] },
    async (request, reply) => {
      const auth = getAuth(request);
      const body = startUploadSchema.parse(request.body);

      const [video, account] = await Promise.all([
        prisma.video.findFirst({
          where: { id: body.videoId, workspaceId: auth.workspaceId },
        }),
        prisma.shopeeAccount.findFirst({
          where: { id: body.shopeeAccountId, workspaceId: auth.workspaceId },
        }),
      ]);

      if (!video) return reply.code(404).send({ message: 'Vídeo não encontrado' });
      if (!account) return reply.code(404).send({ message: 'Conta Shopee não encontrada' });
      if (account.status !== 'ACTIVE') {
        return reply.code(400).send({ message: `Conta com status ${account.status}` });
      }
      if (video.validationStatus !== 'VALID') {
        return reply
          .code(400)
          .send({ message: 'Vídeo não passou na validação local — revise duração/tamanho/tipo' });
      }

      // Atualizar path de staging
      await prisma.video.update({
        where: { id: video.id },
        data: { localStoragePath: body.storagePath },
      });

      // Cria registro de upload na camada relacional
      const upload = await prisma.videoUpload.create({
        data: {
          videoId: video.id,
          shopeeAccountId: account.id,
          uploadStatus: 'PENDING',
          transcodingStatus: 'NOT_STARTED',
          startedAt: new Date(),
        },
      });

      await uploadQueue.add(
        JOB_NAMES.INIT_UPLOAD,
        { videoUploadDbId: upload.id },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: { age: 7 * 24 * 3600, count: 500 },
          removeOnFail: { age: 30 * 24 * 3600 },
        },
      );

      return reply.code(202).send({ uploadId: upload.id });
    },
  );

  // Status do upload
  app.get(
    '/uploads/:id',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const auth = getAuth(request);
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

      const upload = await prisma.videoUpload.findFirst({
        where: { id, video: { workspaceId: auth.workspaceId } },
        include: {
          video: { select: { originalFilename: true, durationSeconds: true } },
        },
      });
      if (!upload) return reply.code(404).send({ message: 'Upload não encontrado' });
      return upload;
    },
  );

  // Cancelar upload
  app.post(
    '/uploads/:id/cancel',
    { onRequest: [app.authenticate, requireRole('OWNER', 'ADMIN', 'OPERATOR')] },
    async (request, reply) => {
      const auth = getAuth(request);
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

      const upload = await prisma.videoUpload.findFirst({
        where: { id, video: { workspaceId: auth.workspaceId } },
      });
      if (!upload) return reply.code(404).send({ message: 'Upload não encontrado' });
      if (['COMPLETED', 'CANCELLED', 'FAILED'].includes(upload.uploadStatus)) {
        return reply.code(400).send({ message: `Upload já está em ${upload.uploadStatus}` });
      }

      // Pede ao worker cancelar — ele chama cancel_video_upload na Shopee
      await uploadQueue.add(
        'cancel-upload',
        { videoUploadDbId: upload.id },
        { attempts: 2 },
      );

      await prisma.videoUpload.update({
        where: { id },
        data: { uploadStatus: 'CANCELLED' },
      });

      await prisma.auditLog.create({
        data: {
          workspaceId: auth.workspaceId,
          actorId: auth.sub,
          entityType: 'VideoUpload',
          entityId: id,
          action: 'CANCEL',
        },
      });

      return reply.code(204).send();
    },
  );
}
