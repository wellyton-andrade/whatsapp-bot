import { createHmac } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import type {
  WebhookDeliveryJobData,
  WebhookDeliveryJobResult,
} from '../../shared/queue/salesQueue.js';

export async function processWebhookDelivery(
  app: FastifyInstance,
  payload: WebhookDeliveryJobData,
): Promise<WebhookDeliveryJobResult> {
  const startedAt = Date.now();
  const body = JSON.stringify({
    event: payload.event,
    tenantId: payload.tenantId,
    payload: payload.payload,
    timestamp: new Date().toISOString(),
  });

  try {
    const response = await fetch(payload.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-webhook-event': payload.event,
        ...(payload.secret
          ? {
              'x-webhook-signature': createHmac('sha256', payload.secret)
                .update(body)
                .digest('hex'),
            }
          : {}),
      },
      body,
    });

    const responseBody = await response.text();

    await app.prisma.webhookDelivery.create({
      data: {
        webhookId: payload.webhookId,
        event: payload.event,
        payload: payload.payload as Prisma.InputJsonValue,
        statusCode: response.status,
        responseBody,
        success: response.ok,
        duration: Date.now() - startedAt,
      },
    });

    await app.prisma.webhook.update({
      where: { id: payload.webhookId },
      data: {
        lastCalledAt: new Date(),
        ...(response.ok ? { failCount: 0 } : { failCount: { increment: 1 } }),
      },
    });

    return {
      processedAt: new Date().toISOString(),
      success: response.ok,
      statusCode: response.status,
      responseBody,
    };
  } catch (error) {
    const responseBody = error instanceof Error ? error.message : 'unknown_error';

    await app.prisma.webhookDelivery.create({
      data: {
        webhookId: payload.webhookId,
        event: payload.event,
        payload: payload.payload as Prisma.InputJsonValue,
        responseBody,
        success: false,
        duration: Date.now() - startedAt,
      },
    });

    await app.prisma.webhook.update({
      where: { id: payload.webhookId },
      data: {
        lastCalledAt: new Date(),
        failCount: { increment: 1 },
      },
    });

    throw error;
  }
}
