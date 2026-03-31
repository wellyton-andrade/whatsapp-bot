import fp from 'fastify-plugin';
import { Redis } from 'ioredis';
import { env } from '../../config/env.js';

export const redisPlugin = fp(async (app) => {
  const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });

  app.decorate('redis', redis);

  app.addHook('onClose', async () => {
    await redis.quit();
  });
});
