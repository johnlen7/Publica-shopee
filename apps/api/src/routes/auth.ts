import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { loginSchema, registerSchema } from '@publica/shared';
import { prisma } from '../prisma.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/auth/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      return reply.code(409).send({ message: 'E-mail já cadastrado' });
    }

    const passwordHash = await bcrypt.hash(body.password, 12);

    const { user, workspaceUser } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: body.email,
          passwordHash,
          name: body.name,
        },
      });
      const workspace = await tx.workspace.create({
        data: { name: body.workspaceName },
      });
      const workspaceUser = await tx.workspaceUser.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          role: 'OWNER',
        },
      });
      return { user, workspaceUser };
    });

    const token = await reply.jwtSign({
      sub: user.id,
      email: user.email,
      workspaceId: workspaceUser.workspaceId,
      role: workspaceUser.role,
    });

    return reply.code(201).send({ accessToken: token });
  });

  app.post('/auth/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const user = await prisma.user.findUnique({
      where: { email: body.email },
      include: {
        workspaces: {
          take: 1,
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!user || user.workspaces.length === 0) {
      return reply.code(401).send({ message: 'Credenciais inválidas' });
    }

    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) {
      return reply.code(401).send({ message: 'Credenciais inválidas' });
    }

    const membership = user.workspaces[0]!;
    const token = await reply.jwtSign({
      sub: user.id,
      email: user.email,
      workspaceId: membership.workspaceId,
      role: membership.role,
    });

    return reply.send({ accessToken: token });
  });

  app.get('/auth/me', { onRequest: [app.authenticate] }, async (request) => {
    const payload = request.user as {
      sub: string;
      email: string;
      workspaceId: string;
      role: string;
    };
    return {
      id: payload.sub,
      email: payload.email,
      workspaceId: payload.workspaceId,
      role: payload.role,
    };
  });
}
