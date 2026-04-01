import 'dotenv/config';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { authRoutes } from './modules/auth/auth.routes.js';
import { tenantsRoutes } from './modules/tenants/tenants.routes.js';
import { usersRoutes } from './modules/users/users.routes.js';
import { whatsappRoutes } from './modules/whatsapp/whatsapp.routes.js';
import { flowsRoutes } from './modules/flows/flows.routes.js';
import { messagesRoutes } from './modules/messages/messages.routes.js';
import { contactsRoutes } from './modules/contacts/contacts.routes.js';
import { webhooksRoutes } from './modules/webhooks/webhooks.routes.js';
import { registerSecurityPlugins } from './shared/plugins/security.js';
import { registerSwagger } from './shared/plugins/swagger.js';
import { prismaPlugin } from './shared/plugins/prisma.js';
import { redisPlugin } from './shared/plugins/redis.js';
import { authPlugin } from './shared/plugins/auth.js';
import { createQueueManager } from './shared/queue/salesQueue.js';
import { AppError } from './shared/errors/appError.js';
import { processInboundMessage } from './modules/whatsapp/inbound.processor.js';
import { WhatsAppService } from './modules/whatsapp/whatsapp.service.js';
import { processWebhookDelivery } from './modules/webhooks/webhook-delivery.processor.js';

type BuildAppOptions = {
  logger?: boolean;
  enableQueue?: boolean;
};

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? true,
  });

  await app.register(prismaPlugin);
  await app.register(redisPlugin);
  await app.register(authPlugin);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ error: error.message });
    }

    if (error instanceof ZodError) {
      return reply.status(422).send({
        error: 'Validation error',
        details: error.issues,
      });
    }

    if (typeof (error as { statusCode?: number }).statusCode === 'number') {
      const statusCode = (error as { statusCode: number }).statusCode;
      const message = error instanceof Error ? error.message : 'Request error';
      return reply.status(statusCode).send({ error: message });
    }

    app.log.error(error);
    return reply.status(500).send({ error: 'Internal server error' });
  });

  await registerSecurityPlugins(app);
  await registerSwagger(app);

  app.decorate('queueManager', null);

  const whatsappService = new WhatsAppService(app);
  app.decorate('whatsappService', whatsappService);

  if (options.enableQueue ?? true) {
    app.queueManager = await createQueueManager({
      onInboundMessage: async (payload) =>
        processInboundMessage(app, payload, {
          sendOutboundMessage: async (to, message) =>
            WhatsAppService.sendFromActiveSession(payload.tenantId, to, message),
        }),
      onWebhookDelivery: async (payload) => processWebhookDelivery(app, payload),
    });
  }

  app.get('/health', async () => ({
    status: 'ok',
    queue: app.queueManager ? 'enabled' : 'disabled',
    timestamp: new Date().toISOString(),
  }));

  app.post('/queues/sales/test', async (request, reply) => {
    if (!app.queueManager) {
      return reply.status(503).send({ error: 'Queue disabled' });
    }

    const body = request.body as Partial<{
      tenantId: string;
      contactPhone: string;
      message: string;
    }>;

    if (!body.tenantId || !body.contactPhone || !body.message) {
      return reply.status(400).send({
        error: 'tenantId, contactPhone and message are required',
      });
    }

    const jobId = await app.queueManager.enqueueSalesMessage({
      tenantId: body.tenantId,
      contactPhone: body.contactPhone,
      message: body.message,
    });

    return reply.status(202).send({ jobId });
  });

  app.get('/queues/sales/:jobId', async (request, reply) => {
    if (!app.queueManager) {
      return reply.status(503).send({ error: 'Queue disabled' });
    }

    const { jobId } = request.params as { jobId: string };
    const result = await app.queueManager.getJobStatus(jobId);

    if (result.status === 'not_found') {
      return reply.status(404).send({ error: 'Job not found' });
    }

    return reply.send(result);
  });

  await authRoutes(app);
  await tenantsRoutes(app);
  await usersRoutes(app);
  await whatsappRoutes(app);
  await flowsRoutes(app);
  await messagesRoutes(app);
  await contactsRoutes(app);
  await webhooksRoutes(app);

  // Attempt to reconnect sessions that were previously connected
  void app.whatsappService.reconnectSessions();

  app.addHook('onClose', async () => {
    if (app.queueManager) {
      await app.queueManager.close();
    }
  });

  return app;
}
