import { Queue, QueueEvents, Worker, type JobsOptions } from 'bullmq';
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

export type QueueManager = {
  enqueueSalesMessage: (payload: SalesJobData, options?: JobsOptions) => Promise<string>;
  getJobStatus: (jobId: string) => Promise<{ status: string; data: SalesJobData | null }>;
  close: () => Promise<void>;
};

const SALES_QUEUE_NAME = 'sales-messages';

export async function createQueueManager(): Promise<QueueManager> {
  const queueConnection = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });

  const workerConnection = new Redis(env.REDIS_URL, {
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

  const events = new QueueEvents(SALES_QUEUE_NAME, {
    connection: queueConnection,
  });

  await queue.waitUntilReady();
  await worker.waitUntilReady();
  await events.waitUntilReady();

  return {
    async enqueueSalesMessage(payload, options) {
      const job = await queue.add('send-sales-message', payload, options);
      return String(job.id);
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
      await events.close();
      await worker.close();
      await queue.close();
      await workerConnection.quit();
      await queueConnection.quit();
    },
  };
}
