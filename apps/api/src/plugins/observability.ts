import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';

/**
 * Observabilidade básica:
 * - request-id propagado via header X-Request-Id
 * - logs estruturados com requestId, route, userId, workspaceId
 */
export const observabilityPlugin = fp(async (app: FastifyInstance) => {
  app.addHook('onRequest', async (request) => {
    const incoming = request.headers['x-request-id'];
    request.id =
      typeof incoming === 'string' && incoming.length > 0 ? incoming : `req_${randomUUID()}`;
  });

  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });
});
