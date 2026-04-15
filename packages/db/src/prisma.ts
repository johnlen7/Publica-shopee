import { PrismaClient } from '@prisma/client';

/**
 * Prisma client singleton reutilizado por api e worker.
 * Conexão feita via DATABASE_URL no environment do processo.
 */
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});
