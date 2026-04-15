import type { FastifyReply, FastifyRequest } from 'fastify';
import type { WorkspaceRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  workspaceId: string;
  role: WorkspaceRole;
}

/**
 * Extrai e tipa o payload JWT a partir do request.user.
 * Use somente em rotas com `onRequest: [app.authenticate]`.
 */
export function getAuth(request: FastifyRequest): JwtPayload {
  return request.user as JwtPayload;
}

/**
 * Guard declarativo de roles — uso:
 *   app.post('/...', { onRequest: [app.authenticate, requireRole('ADMIN', 'OWNER')] }, ...)
 */
export function requireRole(...roles: WorkspaceRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const auth = getAuth(request);
    if (!roles.includes(auth.role)) {
      reply.code(403).send({
        message: `Permissão insuficiente. Exigido: ${roles.join(' ou ')}. Atual: ${auth.role}`,
      });
    }
  };
}
