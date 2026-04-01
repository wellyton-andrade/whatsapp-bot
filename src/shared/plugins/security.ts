import type { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { getCorsOrigins } from '../../config/env.js';

export async function registerSecurityPlugins(app: FastifyInstance): Promise<void> {
  await app.register(helmet);

  await app.register(cors, {
    origin: getCorsOrigins(),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  });

  // Rate limiting: 100 requests per minute
  // Prevents brute force attacks, DDoS, and abuse
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });
}
