import { WebhookEvent } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { processWebhookDelivery } from './webhook-delivery.processor.js';

type DispatchTenantWebhookEventInput = {
  tenantId: string;
  event: WebhookEvent;
  payload: Record<string, unknown>;
};

export async function dispatchTenantWebhookEvent(
  app: FastifyInstance,
  input: DispatchTenantWebhookEventInput,
): Promise<void> {
  const webhooks = await app.prisma.webhook.findMany({
    where: {
      tenantId: input.tenantId,
      isActive: true,
      events: { has: input.event },
    },
    select: {
      id: true,
      url: true,
      secret: true,
    },
  });

  if (webhooks.length === 0) {
    return;
  }

  await Promise.all(
    webhooks.map(async (webhook) => {
      try {
        if (app.queueManager) {
          await app.queueManager.enqueueWebhookDelivery({
            webhookId: webhook.id,
            tenantId: input.tenantId,
            event: input.event,
            url: webhook.url,
            payload: input.payload,
            ...(webhook.secret ? { secret: webhook.secret } : {}),
          });
          return;
        }

        await processWebhookDelivery(app, {
          webhookId: webhook.id,
          tenantId: input.tenantId,
          event: input.event,
          url: webhook.url,
          payload: input.payload,
          ...(webhook.secret ? { secret: webhook.secret } : {}),
        });
      } catch (error) {
        app.log.error(error, `failed to dispatch webhook event ${input.event}`);
      }
    }),
  );
}
