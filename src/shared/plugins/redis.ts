import fp from 'fastify-plugin';
import { Redis } from 'ioredis';
import { env } from '../../config/env.js';

type PipelineOperation = { type: 'set'; key: string; value: string } | { type: 'del'; key: string };

type InMemoryPipeline = {
  set: (key: string, value: string) => InMemoryPipeline;
  del: (key: string) => InMemoryPipeline;
  exec: () => Promise<Array<[null, 'OK' | number]>>;
};

type InMemoryRedis = {
  get: (key: string) => Promise<string | null>;
  set: (...args: Array<string | number>) => Promise<'OK'>;
  del: (...keys: string[]) => Promise<number>;
  scan: (cursor: string, ...args: Array<string | number>) => Promise<[string, string[]]>;
  mget: (...keys: string[]) => Promise<Array<string | null>>;
  pipeline: () => InMemoryPipeline;
  quit: () => Promise<'OK'>;
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Redis connection timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function createInMemoryRedisFallback(): InMemoryRedis {
  const store = new Map<string, string>();
  const expireAt = new Map<string, number>();

  const isExpired = (key: string): boolean => {
    const expires = expireAt.get(key);
    if (!expires) {
      return false;
    }

    if (Date.now() >= expires) {
      store.delete(key);
      expireAt.delete(key);
      return true;
    }

    return false;
  };

  const getLiveKeys = (): string[] => {
    const keys = Array.from(store.keys());
    return keys.filter((key) => !isExpired(key));
  };

  return {
    async get(key) {
      if (isExpired(key)) {
        return null;
      }

      return store.get(key) ?? null;
    },

    async set(...args) {
      const [keyRaw, valueRaw, ttlMode, ttlValue] = args;
      const key = String(keyRaw);
      const value = String(valueRaw);

      store.set(key, value);

      if (ttlMode === 'EX' && typeof ttlValue === 'number') {
        expireAt.set(key, Date.now() + ttlValue * 1000);
      } else {
        expireAt.delete(key);
      }

      return 'OK';
    },

    async del(...keys) {
      let removed = 0;
      for (const key of keys) {
        if (store.delete(key)) {
          removed += 1;
        }
        expireAt.delete(key);
      }

      return removed;
    },

    async scan(cursor, ...args) {
      const matchIndex = args.findIndex((item) => item === 'MATCH');
      const matchPattern =
        matchIndex >= 0 && typeof args[matchIndex + 1] === 'string'
          ? (args[matchIndex + 1] as string)
          : '*';

      const regex = new RegExp(
        `^${matchPattern.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&').replace(/\*/g, '.*')}$`,
      );
      const keys = getLiveKeys().filter((key) => regex.test(key));

      return [cursor === '0' ? '0' : '0', keys];
    },

    async mget(...keys) {
      return Promise.all(keys.map((key) => (isExpired(key) ? null : (store.get(key) ?? null))));
    },

    pipeline() {
      const operations: PipelineOperation[] = [];

      return {
        set(key, value) {
          operations.push({ type: 'set', key, value });
          return this;
        },
        del(key) {
          operations.push({ type: 'del', key });
          return this;
        },
        async exec() {
          const results: Array<[null, 'OK' | number]> = [];
          for (const operation of operations) {
            if (operation.type === 'set') {
              store.set(operation.key, operation.value);
              expireAt.delete(operation.key);
              results.push([null, 'OK']);
            } else {
              const removed = store.delete(operation.key) ? 1 : 0;
              expireAt.delete(operation.key);
              results.push([null, removed]);
            }
          }
          return results;
        },
      };
    },

    async quit() {
      store.clear();
      expireAt.clear();
      return 'OK';
    },
  };
}

export const redisPlugin = fp(async (app) => {
  const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true,
    retryStrategy: (attempt) => {
      if (attempt > 20) {
        app.log.error('redis retry limit reached; keeping degraded mode behavior');
        return null;
      }

      return Math.min(attempt * 250, 3000);
    },
    reconnectOnError: () => true,
  });

  redis.on('error', (error) => {
    app.log.error({ err: error }, 'redis connection error');
  });

  redis.on('reconnecting', (ms: number) => {
    app.log.warn({ delayMs: ms }, 'redis reconnecting');
  });

  let redisClient: Redis | InMemoryRedis = redis;

  try {
    await withTimeout(redis.connect(), 5000);
    await withTimeout(redis.ping(), 3000);
    app.log.info('redis connected');
  } catch (error) {
    app.log.error(
      { err: error },
      'redis unavailable at startup, using in-memory fallback (degraded mode)',
    );
    redisClient = createInMemoryRedisFallback();
  }

  app.decorate('redis', redisClient as unknown as Redis);

  app.addHook('onClose', async () => {
    await redisClient.quit();
  });
});
