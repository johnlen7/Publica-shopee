import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { getAuth, requireRole } from '../plugins/rbac.js';

const templateInputSchema = z.object({
  name: z.string().min(1).max(120),
  title: z.string().max(120).optional(),
  description: z.string().max(2000).optional(),
  hashtags: z.array(z.string().max(60)).max(30).default([]),
  category: z.string().max(120).optional(),
});

export async function templateRoutes(app: FastifyInstance): Promise<void> {
  app.get('/templates', { onRequest: [app.authenticate] }, async (request) => {
    const auth = getAuth(request);
    return prisma.metadataTemplate.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { updatedAt: 'desc' },
    });
  });

  app.post(
    '/templates',
    { onRequest: [app.authenticate, requireRole('OWNER', 'ADMIN', 'OPERATOR')] },
    async (request, reply) => {
      const auth = getAuth(request);
      const body = templateInputSchema.parse(request.body);
      const created = await prisma.metadataTemplate.create({
        data: { ...body, workspaceId: auth.workspaceId },
      });
      await prisma.auditLog.create({
        data: {
          workspaceId: auth.workspaceId,
          actorId: auth.sub,
          entityType: 'MetadataTemplate',
          entityId: created.id,
          action: 'CREATE',
          payload: body,
        },
      });
      return reply.code(201).send(created);
    },
  );

  app.put(
    '/templates/:id',
    { onRequest: [app.authenticate, requireRole('OWNER', 'ADMIN', 'OPERATOR')] },
    async (request, reply) => {
      const auth = getAuth(request);
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = templateInputSchema.parse(request.body);

      const existing = await prisma.metadataTemplate.findFirst({
        where: { id, workspaceId: auth.workspaceId },
      });
      if (!existing) return reply.code(404).send({ message: 'Template não encontrado' });

      // Versionamento simples: incrementa version em cada update (PRD §6.5)
      const updated = await prisma.metadataTemplate.update({
        where: { id },
        data: { ...body, version: { increment: 1 } },
      });
      await prisma.auditLog.create({
        data: {
          workspaceId: auth.workspaceId,
          actorId: auth.sub,
          entityType: 'MetadataTemplate',
          entityId: id,
          action: 'UPDATE',
          payload: body,
        },
      });
      return updated;
    },
  );

  app.delete(
    '/templates/:id',
    { onRequest: [app.authenticate, requireRole('OWNER', 'ADMIN')] },
    async (request, reply) => {
      const auth = getAuth(request);
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const existing = await prisma.metadataTemplate.findFirst({
        where: { id, workspaceId: auth.workspaceId },
      });
      if (!existing) return reply.code(404).send({ message: 'Template não encontrado' });

      await prisma.metadataTemplate.delete({ where: { id } });
      await prisma.auditLog.create({
        data: {
          workspaceId: auth.workspaceId,
          actorId: auth.sub,
          entityType: 'MetadataTemplate',
          entityId: id,
          action: 'DELETE',
        },
      });
      return reply.code(204).send();
    },
  );
}
