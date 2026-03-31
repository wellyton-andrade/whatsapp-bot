import type { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { env } from '../../config/env.js';

export async function registerSwagger(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'WhatsApp Sales Bot API',
        description: 'API multi-tenant para bot de vendas no WhatsApp',
        version: '1.0.0',
      },
      servers: [{ url: env.SERVER_URL }],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });
}
