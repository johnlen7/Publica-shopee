import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { JOB_NAMES } from '@publica/shared';
import { prisma } from '../prisma.js';
import { publishQueue } from '../queues.js';
import { getAuth, requireRole } from '../plugins/rbac.js';

/**
 * Importação em massa de agendamentos.
 *
 * Aceita um array de linhas em JSON (o frontend converte CSV/XLSX no cliente,
 * mantendo o backend leve e sem dependências de parsers de planilha).
 *
 * Contrato do PRD §6.4: falhas individuais NÃO derrubam o lote.
 */

const importRowSchema = z.object({
  videoId: z.string().uuid(),
  shopeeAccountId: z.string().uuid(),
  scheduledFor: z.string().datetime(),
  timezone: z.string().default('America/Sao_Paulo'),
  title: z.string().max(120).optional(),
  description: z.string().max(2000).optional(),
  hashtags: z.array(z.string()).max(30).optional(),
  category: z.string().optional(),
});

const importPayloadSchema = z.object({
  rows: z.array(z.unknown()).min(1).max(500),
});

export async function importRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/import/schedule',
    { onRequest: [app.authenticate, requireRole('OWNER', 'ADMIN', 'OPERATOR')] },
    async (request, reply) => {
      const auth = getAuth(request);
      const { rows } = importPayloadSchema.parse(request.body);

      const results = {
        total: rows.length,
        accepted: 0,
        rejected: 0,
        items: [] as Array<{
          index: number;
          status: 'accepted' | 'rejected';
          jobId?: string;
          error?: string;
        }>,
      };

      for (let i = 0; i < rows.length; i++) {
        const raw = rows[i];
        try {
          const row = importRowSchema.parse(raw);

          const [video, account] = await Promise.all([
            prisma.video.findFirst({
              where: { id: row.videoId, workspaceId: auth.workspaceId },
              include: { uploads: { orderBy: { createdAt: 'desc' }, take: 1 } },
            }),
            prisma.shopeeAccount.findFirst({
              where: { id: row.shopeeAccountId, workspaceId: auth.workspaceId },
            }),
          ]);

          if (!video) throw new Error('Vídeo não encontrado neste workspace');
          if (!account) throw new Error('Conta Shopee não encontrada neste workspace');
          if (account.status !== 'ACTIVE') throw new Error(`Conta com status ${account.status}`);

          const lastUpload = video.uploads[0];
          if (!lastUpload || lastUpload.transcodingStatus !== 'SUCCEEDED') {
            throw new Error('Upload do vídeo ainda não concluído');
          }

          const scheduledFor = new Date(row.scheduledFor);
          if (scheduledFor.getTime() <= Date.now()) {
            throw new Error('scheduledFor deve ser futuro');
          }

          const job = await prisma.publishJob.create({
            data: {
              videoId: row.videoId,
              shopeeAccountId: row.shopeeAccountId,
              scheduledFor,
              timezone: row.timezone,
              createdById: auth.sub,
              status: 'SCHEDULED',
            },
          });

          // Metadata opcional por linha
          if (row.title || row.description || row.hashtags || row.category) {
            await prisma.videoMetadata.upsert({
              where: { videoId: row.videoId },
              update: {
                title: row.title ?? undefined,
                description: row.description ?? undefined,
                hashtags: row.hashtags ?? undefined,
                category: row.category ?? undefined,
                version: { increment: 1 },
              },
              create: {
                videoId: row.videoId,
                title: row.title ?? '(sem título)',
                description: row.description,
                hashtags: row.hashtags ?? [],
                category: row.category,
              },
            });
          }

          await publishQueue.add(
            JOB_NAMES.PUBLISH_VIDEO,
            { publishJobId: job.id },
            {
              delay: scheduledFor.getTime() - Date.now(),
              jobId: job.id,
              attempts: 5,
              backoff: { type: 'exponential', delay: 30_000 },
            },
          );

          results.accepted++;
          results.items.push({ index: i, status: 'accepted', jobId: job.id });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Erro desconhecido';
          results.rejected++;
          results.items.push({ index: i, status: 'rejected', error: message });
        }
      }

      await prisma.auditLog.create({
        data: {
          workspaceId: auth.workspaceId,
          actorId: auth.sub,
          entityType: 'BulkImport',
          entityId: `import_${Date.now()}`,
          action: 'IMPORT_SCHEDULE',
          payload: { total: results.total, accepted: results.accepted, rejected: results.rejected },
        },
      });

      return reply.code(200).send(results);
    },
  );
}
