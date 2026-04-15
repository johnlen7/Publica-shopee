import Fastify from 'fastify';
import cors from '@fastify/cors';
import { ZodError } from 'zod';
import { authPlugin } from './plugins/auth.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { videoRoutes } from './routes/videos.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      transport:
        process.env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
          : undefined,
    },
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(authPlugin);

  app.setErrorHandler((error: unknown, _req, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        message: 'Validação falhou',
        issues: error.issues,
      });
    }
    app.log.error(error);
    const err = error as { statusCode?: number; message?: string };
    return reply.code(err.statusCode ?? 500).send({
      message: err.message ?? 'Erro interno',
    });
  });

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(videoRoutes);

  return app;
}
