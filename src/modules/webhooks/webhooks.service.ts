import { createHmac } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { env } from '../../config/env.js';
import type {
  CreateApiKeyInput,
  CreateWebhookInput,
  TestWebhookInput,
  UpdateWebhookInput,
} from './webhooks.schema.js';

export class WebhooksService {
  constructor(private readonly app: FastifyInstance) {}

  private hashApiKey(rawKey: string): string {
    return createHmac('sha256', env.JWT_SECRET).update(rawKey).digest('hex');
  }

  async list(tenantId: string) {
    return this.app.prisma.webhook.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(tenantId: string, data: CreateWebhookInput) {
    return this.app.prisma.webhook.create({
      data: {
        tenantId,
        name: data.name,
        url: data.url,
        events: data.events,
        ...(data.secret !== undefined ? { secret: data.secret } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  async getById(tenantId: string, id: string) {
    return this.app.prisma.webhook.findFirst({
      where: { id, tenantId },
    });
  }

  async update(tenantId: string, id: string, data: UpdateWebhookInput) {
    return this.app.prisma.webhook.updateMany({
      where: { id, tenantId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.url !== undefined ? { url: data.url } : {}),
        ...(data.events !== undefined ? { events: data.events } : {}),
        ...(data.secret !== undefined ? { secret: data.secret } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.app.prisma.webhook.deleteMany({
      where: { id, tenantId },
    });
  }

  async createApiKey(tenantId: string, data: CreateApiKeyInput) {
    const prefix = `wk_${Math.random().toString(36).slice(2, 8)}`;
    const secret = `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    const rawKey = `${prefix}.${secret}`;

    const apiKey = await this.app.prisma.apiKey.create({
      data: {
        tenantId,
        name: data.name,
        prefix,
        keyHash: this.hashApiKey(rawKey),
        ...(data.expiresAt ? { expiresAt: new Date(data.expiresAt) } : {}),
      },
      select: {
        id: true,
        name: true,
        prefix: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    return {
      ...apiKey,
      key: rawKey,
    };
  }

  async listApiKeys(tenantId: string) {
    return this.app.prisma.apiKey.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        prefix: true,
        lastUsedAt: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async dispatchTest(tenantId: string, id: string, data: TestWebhookInput) {
    const webhook = await this.getById(tenantId, id);
    if (!webhook || !webhook.isActive) {
      return null;
    }

    if (!this.app.queueManager) {
      const body = JSON.stringify({
        event: data.event,
        tenantId,
        timestamp: new Date().toISOString(),
        payload: data.payload,
      });

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-event': data.event,
          ...(webhook.secret
            ? {
                'x-webhook-signature': createHmac('sha256', webhook.secret)
                  .update(body)
                  .digest('hex'),
              }
            : {}),
        },
        body,
      });

      const responseBody = await response.text();

      await this.app.prisma.webhookDelivery.create({
        data: {
          webhookId: webhook.id,
          event: data.event,
          payload: data.payload as Prisma.InputJsonValue,
          statusCode: response.status,
          responseBody,
          success: response.ok,
        },
      });

      return {
        queued: false,
        success: response.ok,
        statusCode: response.status,
        responseBody,
      };
    }

    const jobId = await this.app.queueManager.enqueueWebhookDelivery(
      {
        webhookId: webhook.id,
        tenantId,
        event: data.event,
        url: webhook.url,
        payload: data.payload,
        ...(webhook.secret ? { secret: webhook.secret } : {}),
      },
      {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    );

    return {
      queued: true,
      jobId,
    };
  }
}
