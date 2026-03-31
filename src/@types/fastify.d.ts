import type { QueueManager } from '../shared/queue/salesQueue.js';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    redis: Redis;
    queueManager: QueueManager | null;
  }

  interface FastifyRequest {
    authUser?: {
      userId: string;
      tenantId?: string;
      role: 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR';
    };
  }
}
