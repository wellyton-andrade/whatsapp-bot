import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { UserRole, type PrismaClient } from '@prisma/client';
import { buildApp } from '../../src/app';
import type { QueueManager } from '../../src/shared/queue/salesQueue';
import { hashPassword } from '../../src/shared/utils/hash';

type TestApp = Awaited<ReturnType<typeof buildApp>> & {
  prisma: PrismaClient;
  queueManager: QueueManager | null;
};

describe('Webhooks Integration Tests', () => {
  let app: TestApp;
  let tenantId = '';
  let accessToken = '';

  beforeAll(async () => {
    app = (await buildApp({ logger: false, enableQueue: false })) as TestApp;

    const tenant = await app.prisma.tenant.create({
      data: {
        name: 'Tenant Webhook Test',
        slug: `tenant-webhook-${Date.now()}`,
        email: `tenant.webhook.${Date.now()}@example.com`,
      },
    });

    tenantId = tenant.id;

    const email = `webhook.test.${Date.now()}@example.com`;
    const password = '12345678';

    await app.prisma.user.create({
      data: {
        tenantId,
        name: 'Webhook Tester',
        email,
        passwordHash: await hashPassword(password),
        role: UserRole.ADMIN,
      },
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email,
        password,
      },
    });

    accessToken = loginResponse.json<{ accessToken: string }>().accessToken;

    app.queueManager = {
      enqueueSalesMessage: async () => 'sales-job',
      enqueueInboundMessage: async () => 'inbound-job',
      enqueueWebhookDelivery: async () => 'webhook-job',
      getSalesJobStatus: async () => ({ status: 'completed', data: null }),
      getInboundJobStatus: async () => ({ status: 'completed', data: null }),
      getWebhookJobStatus: async () => ({ status: 'completed', data: null }),
      getJobStatus: async () => ({ status: 'completed', data: null }),
      close: async () => {},
    };
  });

  afterAll(async () => {
    await app.prisma.tenant.deleteMany({ where: { id: tenantId } });
    await app.close();
  });

  test('should create api key and accept inbound event with x-api-key', async () => {
    const apiKeyResponse = await app.inject({
      method: 'POST',
      url: '/webhooks/api-keys',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: {
        name: 'Inbound Key',
      },
    });

    expect(apiKeyResponse.statusCode).toBe(201);
    const body = apiKeyResponse.json<{ key: string }>();
    expect(typeof body.key).toBe('string');

    const inboundResponse = await app.inject({
      method: 'POST',
      url: '/webhooks/events/inbound',
      headers: {
        'x-api-key': body.key,
      },
      payload: {
        contactPhone: '5511999999999',
        message: 'oi',
      },
    });

    expect(inboundResponse.statusCode).toBe(202);
    expect(inboundResponse.json<{ jobId: string }>().jobId).toBe('inbound-job');
  });
});
