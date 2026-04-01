import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../shared/middlewares/authenticate.js';
import { authenticateApiKey } from '../../shared/middlewares/authenticateApiKey.js';
import { resolveTenant } from '../../shared/middlewares/resolveTenant.js';
import { WebhooksController } from './webhooks.controller.js';
import { WebhooksService } from './webhooks.service.js';
import { inboundWebhookSchema } from './webhooks.schema.js';

export async function webhooksRoutes(app: FastifyInstance): Promise<void> {
  const guard = [authenticate, resolveTenant];
  const service = new WebhooksService(app);
  const controller = new WebhooksController(service);

  app.post('/webhooks', { preHandler: guard }, controller.create);
  app.get('/webhooks', { preHandler: guard }, controller.list);
  app.get('/webhooks/:id', { preHandler: guard }, controller.getById);
  app.patch('/webhooks/:id', { preHandler: guard }, controller.update);
  app.delete('/webhooks/:id', { preHandler: guard }, controller.remove);
  app.post('/webhooks/:id/test', { preHandler: guard }, controller.test);
  app.post('/webhooks/api-keys', { preHandler: guard }, controller.createApiKey);
  app.get('/webhooks/api-keys', { preHandler: guard }, controller.listApiKeys);

  app.post(
    '/webhooks/events/inbound',
    { preHandler: [authenticateApiKey] },
    async (request, reply) => {
      const tenantId = request.authUser?.tenantId;
      if (!tenantId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Use Zod schema for proper validation instead of manual checks
      const data = inboundWebhookSchema.parse(request.body);

      if (!app.queueManager) {
        return reply.status(503).send({ error: 'Queue disabled' });
      }

      const jobId = await app.queueManager.enqueueInboundMessage({
        tenantId,
        contactPhone: data.contactPhone,
        message: data.message,
        ...(data.waMessageId !== undefined ? { waMessageId: data.waMessageId } : {}),
      });

      return reply.status(202).send({ jobId });
    },
  );
}
