import { Queue, QueueEvents, Worker, type JobsOptions } from 'bullmq';
import type { WebhookEvent } from '@prisma/client';
import { Redis } from 'ioredis';
import { env } from '../../config/env.js';

type SalesJobData = {
  tenantId: string;
  contactPhone: string;
  message: string;
};

type SalesJobResult = {
  processedAt: string;
  tenantId: string;
  contactPhone: string;
};

export type InboundMessageJobData = {
  tenantId: string;
  contactPhone: string;
  message: string;
  waMessageId?: string;
};

export type InboundMessageJobResult = {
  processedAt: string;
  tenantId: string;
  contactPhone: string;
  replySent: boolean;
};

export type WebhookDeliveryJobData = {
  webhookId: string;
  tenantId: string;
  event: WebhookEvent;
  url: string;
  payload: Record<string, unknown>;
  secret?: string;
};

export type WebhookDeliveryJobResult = {
  processedAt: string;
  success: boolean;
  statusCode?: number;
  responseBody?: string;
};

type QueueHandlers = {
  onInboundMessage?: (payload: InboundMessageJobData) => Promise<InboundMessageJobResult>;
  onWebhookDelivery?: (payload: WebhookDeliveryJobData) => Promise<WebhookDeliveryJobResult>;
};

export type QueueManager = {
  enqueueSalesMessage: (payload: SalesJobData, options?: JobsOptions) => Promise<string>;
  enqueueInboundMessage: (payload: InboundMessageJobData, options?: JobsOptions) => Promise<string>;
  enqueueWebhookDelivery: (
    payload: WebhookDeliveryJobData,
    options?: JobsOptions,
  ) => Promise<string>;
  getSalesJobStatus: (jobId: string) => Promise<{ status: string; data: SalesJobData | null }>;
  getInboundJobStatus: (
    jobId: string,
  ) => Promise<{ status: string; data: InboundMessageJobData | null }>;
  getWebhookJobStatus: (
    jobId: string,
  ) => Promise<{ status: string; data: WebhookDeliveryJobData | null }>;
  getJobStatus: (jobId: string) => Promise<{ status: string; data: SalesJobData | null }>;
  close: () => Promise<void>;
};

const SALES_QUEUE_NAME = 'sales-messages';
const INBOUND_QUEUE_NAME = 'inbound-messages';
const WEBHOOK_QUEUE_NAME = 'webhook-deliveries';

export async function createQueueManager(handlers: QueueHandlers = {}): Promise<QueueManager> {
  const queueConnection = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });

  const workerConnection = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });

  const webhookWorkerConnection = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });

  const queue = new Queue<SalesJobData, SalesJobResult>(SALES_QUEUE_NAME, {
    connection: queueConnection,
    defaultJobOptions: {
      attempts: 3,
      removeOnComplete: 100,
      removeOnFail: 500,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    },
  });

  const inboundQueue = new Queue<InboundMessageJobData, InboundMessageJobResult>(
    INBOUND_QUEUE_NAME,
    {
      connection: queueConnection,
      defaultJobOptions: {
        attempts: 3,
        removeOnComplete: 100,
        removeOnFail: 500,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    },
  );

  const webhookQueue = new Queue<WebhookDeliveryJobData, WebhookDeliveryJobResult>(
    WEBHOOK_QUEUE_NAME,
    {
      connection: queueConnection,
      defaultJobOptions: {
        attempts: 5,
        removeOnComplete: 200,
        removeOnFail: 1000,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    },
  );

  const worker = new Worker<SalesJobData, SalesJobResult>(
    SALES_QUEUE_NAME,
    async (job) => ({
      processedAt: new Date().toISOString(),
      tenantId: job.data.tenantId,
      contactPhone: job.data.contactPhone,
    }),
    {
      connection: workerConnection,
    },
  );

  const inboundWorker = new Worker<InboundMessageJobData, InboundMessageJobResult>(
    INBOUND_QUEUE_NAME,
    async (job) => {
      if (handlers.onInboundMessage) {
        return handlers.onInboundMessage(job.data);
      }

      return {
        processedAt: new Date().toISOString(),
        tenantId: job.data.tenantId,
        contactPhone: job.data.contactPhone,
        replySent: false,
      };
    },
    {
      connection: workerConnection,
    },
  );

  const webhookWorker = new Worker<WebhookDeliveryJobData, WebhookDeliveryJobResult>(
    WEBHOOK_QUEUE_NAME,
    async (job) => {
      if (handlers.onWebhookDelivery) {
        return handlers.onWebhookDelivery(job.data);
      }

      return {
        processedAt: new Date().toISOString(),
        success: false,
        responseBody: 'webhook handler not configured',
      };
    },
    {
      connection: webhookWorkerConnection,
    },
  );

  const events = new QueueEvents(SALES_QUEUE_NAME, {
    connection: queueConnection,
  });

  const inboundEvents = new QueueEvents(INBOUND_QUEUE_NAME, {
    connection: queueConnection,
  });

  const webhookEvents = new QueueEvents(WEBHOOK_QUEUE_NAME, {
    connection: queueConnection,
  });

  await queue.waitUntilReady();
  await inboundQueue.waitUntilReady();
  await webhookQueue.waitUntilReady();
  await worker.waitUntilReady();
  await inboundWorker.waitUntilReady();
  await webhookWorker.waitUntilReady();
  await events.waitUntilReady();
  await inboundEvents.waitUntilReady();
  await webhookEvents.waitUntilReady();

  return {
    async enqueueSalesMessage(payload, options) {
      const job = await queue.add('send-sales-message', payload, options);
      return String(job.id);
    },

    async enqueueInboundMessage(payload, options) {
      const job = await inboundQueue.add('process-inbound-message', payload, options);
      return String(job.id);
    },

    async enqueueWebhookDelivery(payload, options) {
      const job = await webhookQueue.add('deliver-webhook', payload, options);
      return String(job.id);
    },

    async getSalesJobStatus(jobId) {
      const job = await queue.getJob(jobId);
      if (!job) {
        return { status: 'not_found', data: null };
      }

      return {
        status: await job.getState(),
        data: job.data,
      };
    },

    async getInboundJobStatus(jobId) {
      const job = await inboundQueue.getJob(jobId);
      if (!job) {
        return { status: 'not_found', data: null };
      }

      return {
        status: await job.getState(),
        data: job.data,
      };
    },

    async getWebhookJobStatus(jobId) {
      const job = await webhookQueue.getJob(jobId);
      if (!job) {
        return { status: 'not_found', data: null };
      }

      return {
        status: await job.getState(),
        data: job.data,
      };
    },

    async getJobStatus(jobId) {
      const job = await queue.getJob(jobId);
      if (!job) {
        return { status: 'not_found', data: null };
      }

      return {
        status: await job.getState(),
        data: job.data,
      };
    },

    async close() {
      await webhookEvents.close();
      await inboundEvents.close();
      await events.close();
      await webhookWorker.close();
      await inboundWorker.close();
      await worker.close();
      await webhookQueue.close();
      await inboundQueue.close();
      await queue.close();
      await webhookWorkerConnection.quit();
      await workerConnection.quit();
      await queueConnection.quit();
    },
  };
}
