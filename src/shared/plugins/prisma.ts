import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { env } from '../../config/env.js';

export const prismaPlugin = fp(async (app) => {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
  });

  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  app.decorate('prisma', prisma);

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
    await pool.end();
  });
});
