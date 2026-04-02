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
    // Centralized logging: use native Fastify logger
    // - disableRequestLogging is false (default), so Fastify handles req/res lifecycle logs
    // - Custom hooks only add structured context when needed (requestId correlation)
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    genReqId: (request) => {
      const headerRequestId = request.headers['x-request-id'];
      // Validate x-request-id is UUID format to prevent log injection attacks
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (
        typeof headerRequestId === 'string' &&
        headerRequestId.length > 0 &&
        uuidRegex.test(headerRequestId)
      ) {
        return headerRequestId;
      }
      return randomUUID();
    },
  });

  // Removed custom onRequest/onResponse hooks - using native Fastify logging
  // Fastify automatically logs request completion with timing and status code
  // This provides consistent, structured logging without duplication

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
      // Never expose internal error messages in production (4xx errors)
      message = 'Bad request';
      if (env.NODE_ENV === 'development') {
        message = error instanceof Error ? error.message : 'Request error';
      }
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

    // Log ZodError details internally but only expose in development
    if (error instanceof ZodError) {
      app.log.error(
        {
          issues: error.issues,
          requestId: request.id,
        },
        'validation error details',
      );
    }

    return reply.status(statusCode).send({
      message,
      error: message,
      ...(env.NODE_ENV === 'development' && error instanceof ZodError
        ? { details: error.issues }
        : {}),
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
      onInboundMessage: async (payload) => {
        try {
          return await processInboundMessage(app, payload, {
            sendOutboundMessage: async (to, message) =>
              WhatsAppService.sendFromActiveSession(payload.tenantId, to, message),
          });
        } catch (error) {
          app.log.error(
            {
              err: error,
              tenantId: payload.tenantId,
              contactPhone: payload.contactPhone,
            },
            'failed to process inbound message - job will retry',
          );
          throw error; // Re-throw to let BullMQ handle retry strategy
        }
      },
      onWebhookDelivery: async (payload) => {
        try {
          return await processWebhookDelivery(app, payload);
        } catch (error) {
          app.log.error(
            {
              err: error,
              webhookId: payload.webhookId,
              tenantId: payload.tenantId,
            },
            'failed to deliver webhook - job will retry',
          );
          throw error;
        }
      },
    });
  }

  app.get('/health', async () => ({
    status: 'ok',
    code: 200,
    queue: app.queueManager ? 'enabled' : 'disabled',
    timestamp: new Date().toISOString(),
  }));

  // REMOVED: /queues/sales/test endpoint
  // This was a security risk: exposed without authentication, allowed anyone to trigger queue jobs
  // Use internal admin panel or protected API endpoints for testing instead

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
  app.whatsappService.reconnectSessions().catch((err) => {
    app.log.error(err, 'failed to reconnect WhatsApp sessions on startup');
  });

  // Graceful shutdown: close all resources in correct order
  app.addHook('onClose', async () => {
    // 0. Close WhatsApp sessions first (prevents memory leaks from singletons)
    if (app.whatsappService) {
      app.log.info('closing whatsapp sessions...');
      await WhatsAppService.closeSessions();
    }

    // 1. Close queue (allows in-flight jobs to complete)
    if (app.queueManager) {
      app.log.info('closing queue manager...');
      await app.queueManager.close();
    }

    // 2. Close Prisma connection
    if (app.prisma) {
      app.log.info('closing prisma connection...');
      await app.prisma.$disconnect();
    }

    // 3. Redis is closed by the redis plugin's onClose hook (avoid double close)

    app.log.info('graceful shutdown completed');
  });

  return app;
}
