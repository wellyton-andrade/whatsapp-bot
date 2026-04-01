import 'dotenv/config';
import { randomUUID } from 'node:crypto';
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
import { env } from './config/env.js';

type BuildAppOptions = {
  logger?: boolean;
  enableQueue?: boolean;
};

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const loggerConfig =
    options.logger === false
      ? false
      : {
          level: env.LOG_LEVEL,
          messageKey: 'message',
          base: {
            service: 'whatsapp-bot-api',
            env: env.NODE_ENV,
          },
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.body.password',
              'req.body.currentPassword',
              'req.body.newPassword',
              'req.body.refreshToken',
              'headers.authorization',
              'headers.cookie',
            ],
            censor: '[REDACTED]',
          },
        };

  const app = Fastify({
    logger: loggerConfig,
    disableRequestLogging: true,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    genReqId: (request) => {
      const headerRequestId = request.headers['x-request-id'];
      return typeof headerRequestId === 'string' && headerRequestId.length > 0
        ? headerRequestId
        : randomUUID();
    },
  });

  app.addHook('onRequest', async (request) => {
    request.log.info(
      {
        requestId: request.id,
        method: request.method,
        path: request.url,
      },
      'request received',
    );
  });

  app.addHook('onResponse', async (request, reply) => {
    request.log.info(
      {
        requestId: request.id,
        method: request.method,
        path: request.url,
        statusCode: reply.statusCode,
        responseTimeMs: reply.elapsedTime,
      },
      'request completed',
    );
  });

  await app.register(prismaPlugin);
  await app.register(redisPlugin);
  await app.register(authPlugin);

  app.setErrorHandler((error, request, reply) => {
    let statusCode = 500;

    if (error instanceof AppError) {
      statusCode = error.statusCode;
    } else if (error instanceof ZodError) {
      statusCode = 422;
    } else if (typeof (error as { statusCode?: number }).statusCode === 'number') {
      const candidate = (error as { statusCode: number }).statusCode;
      if (candidate >= 400 && candidate < 600) {
        statusCode = candidate;
      }
    }

    let message = 'Internal server error';

    if (error instanceof AppError) {
      message = error.message;
    } else if (error instanceof ZodError) {
      message = 'Validation error';
    } else if (statusCode < 500) {
      message = error instanceof Error ? error.message : 'Request error';
    }

    if (statusCode >= 500) {
      app.log.error(
        {
          err: error,
          requestId: request.id,
          method: request.method,
          url: request.url,
        },
        'unhandled application error',
      );
    }

    return reply.status(statusCode).send({
      message,
      error: message,
      ...(error instanceof ZodError ? { details: error.issues } : {}),
      ...(statusCode >= 500 ? { requestId: request.id } : {}),
    });
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
