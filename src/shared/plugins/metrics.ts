import fp from 'fastify-plugin';
import { Counter, Gauge, Histogram, register } from 'prom-client';
import type { FastifyPluginAsync } from 'fastify';

// HTTP metrics
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_ms',
  help: 'HTTP request latency in milliseconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [10, 50, 100, 500, 1000, 2000],
});

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

export const httpErrorsTotal = new Counter({
  name: 'http_errors_total',
  help: 'Total number of HTTP errors',
  labelNames: ['method', 'route', 'status_code'],
});

// Queue metrics
export const queueJobsEnqueued = new Counter({
  name: 'queue_jobs_enqueued_total',
  help: 'Total jobs enqueued',
  labelNames: ['queue_name'],
});

export const queueJobsCompleted = new Counter({
  name: 'queue_jobs_completed_total',
  help: 'Total jobs completed successfully',
  labelNames: ['queue_name'],
});

export const queueJobsFailed = new Counter({
  name: 'queue_jobs_failed_total',
  help: 'Total jobs failed',
  labelNames: ['queue_name'],
});

export const queueJobsActive = new Gauge({
  name: 'queue_jobs_active',
  help: 'Currently active jobs per queue',
  labelNames: ['queue_name'],
});

// Database metrics
export const databaseQueryDuration = new Histogram({
  name: 'database_query_duration_ms',
  help: 'Database query latency in milliseconds',
  labelNames: ['operation'],
  buckets: [10, 50, 100, 500, 1000],
});

export const databaseConnectionsActive = new Gauge({
  name: 'database_connections_active',
  help: 'Active database connections',
});

// Redis metrics
export const redisCommandDuration = new Histogram({
  name: 'redis_command_duration_ms',
  help: 'Redis command latency in milliseconds',
  labelNames: ['command'],
  buckets: [1, 5, 10, 50, 100],
});

export const redisConnectionStatus = new Gauge({
  name: 'redis_connection_connected',
  help: 'Redis connection status (1 = connected, 0 = disconnected)',
});

export const metricsPlugin: FastifyPluginAsync = async (app): Promise<void> => {
  // Expose metrics endpoint
  app.get('/metrics', async () => {
    return register.metrics();
  });

  // HTTP request tracking
  app.addHook('onRequest', async (request) => {
    const startTime = Date.now();

    // Store start time for later use
    (request as any).metricsStartTime = startTime;
  });

  app.addHook('onResponse', async (request, reply) => {
    const duration = Date.now() - ((request as any).metricsStartTime || Date.now());

    // Extract route from URL (basic normalization)
    const route = request.url === '/health' ? '/health' : (request.url.split('?')[0] ?? '/');

    try {
      httpRequestDuration.observe(
        {
          method: request.method,
          route,
          status_code: reply.statusCode,
        },
        duration,
      );

      httpRequestTotal.inc({
        method: request.method,
        route,
        status_code: reply.statusCode,
      });

      if (reply.statusCode >= 400) {
        httpErrorsTotal.inc({
          method: request.method,
          route,
          status_code: reply.statusCode,
        });
      }
    } catch (error) {
      // Silently ignore metrics errors to avoid crashing the app
      app.log.trace(error, 'failed to record http metrics');
    }
  });
};

export default fp(metricsPlugin);
