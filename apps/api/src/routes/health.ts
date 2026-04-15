import type { FastifyInstance } from 'fastify';
import type { HealthcheckResponse } from '@publica/shared';
import { prisma } from '../prisma.js';
import { redis } from '../redis.js';

const startedAt = Date.now();

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (): Promise<HealthcheckResponse> => {
    let dbOk = false;
    let redisOk = false;

    try {
      await prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {
      dbOk = false;
    }

    try {
      const pong = await redis.ping();
      redisOk = pong === 'PONG';
    } catch {
      redisOk = false;
    }

    const allOk = dbOk && redisOk;

    return {
      status: allOk ? 'ok' : 'degraded',
      uptime: Math.floor((Date.now() - startedAt) / 1000),
      version: process.env.npm_package_version ?? '0.1.0',
      checks: {
        db: dbOk ? 'ok' : 'fail',
        redis: redisOk ? 'ok' : 'fail',
      },
    };
  });
}
