import type { FastifyInstance } from 'fastify';
import { videoValidationSchema, echoJobSchema, JOB_NAMES } from '@publica/shared';
import { prisma } from '../prisma.js';
import { uploadQueue } from '../queues.js';

export async function videoRoutes(app: FastifyInstance): Promise<void> {
  // Listar vídeos do workspace
  app.get('/videos', { onRequest: [app.authenticate] }, async (request) => {
    const payload = request.user as { workspaceId: string };
    const videos = await prisma.video.findMany({
      where: { workspaceId: payload.workspaceId },
      orderBy: { createdAt: 'desc' },
      include: { metadata: true, uploads: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    return videos.map((v) => ({
      ...v,
      fileSizeBytes: v.fileSizeBytes.toString(),
    }));
  });

  // Registrar um vídeo validado localmente (pré-upload à Shopee)
  app.post('/videos', { onRequest: [app.authenticate] }, async (request, reply) => {
    const payload = request.user as { workspaceId: string };
    const body = videoValidationSchema.parse(request.body);

    const video = await prisma.video.create({
      data: {
        workspaceId: payload.workspaceId,
        originalFilename: body.filename,
        mimeType: body.mimeType,
        fileSizeBytes: BigInt(body.fileSizeBytes),
        durationSeconds: body.durationSeconds,
        validationStatus: 'VALID',
      },
    });

    return reply.code(201).send({
      ...video,
      fileSizeBytes: video.fileSizeBytes.toString(),
    });
  });

  // Enfileirar job de eco (teste de pipeline Fase 0)
  app.post('/jobs/echo', { onRequest: [app.authenticate] }, async (request, reply) => {
    const body = echoJobSchema.parse(request.body);
    const job = await uploadQueue.add(JOB_NAMES.ECHO, body, {
      delay: body.delayMs,
      removeOnComplete: 100,
      removeOnFail: 100,
    });
    return reply.code(202).send({ jobId: job.id, message: 'enfileirado' });
  });
}
