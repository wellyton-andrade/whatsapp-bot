import {
  BufferJSON,
  initAuthCreds,
  proto,
  type AuthenticationState,
  type SignalDataSet,
} from '@whiskeysockets/baileys';
import type { Redis } from 'ioredis';

function authCredsKey(tenantId: string): string {
  return `wa:auth:${tenantId}:creds`;
}

function authSignalKey(tenantId: string, type: string, id: string): string {
  return `wa:auth:${tenantId}:key:${type}:${id}`;
}

function authSignalPattern(tenantId: string): string {
  return `wa:auth:${tenantId}:key:*`;
}

export async function clearRedisAuthState(redis: Redis, tenantId: string): Promise<void> {
  const credsKey = authCredsKey(tenantId);
  const pattern = authSignalPattern(tenantId);

  const keysToDelete: string[] = [credsKey];
  let cursor = '0';

  do {
    const [nextCursor, foundKeys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
    cursor = nextCursor;
    keysToDelete.push(...foundKeys);
  } while (cursor !== '0');

  if (keysToDelete.length > 0) {
    await redis.del(...keysToDelete);
  }
}

export async function useRedisAuthState(
  redis: Redis,
  tenantId: string,
): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> {
  const credsRaw = await redis.get(authCredsKey(tenantId));
  const creds = credsRaw
    ? (JSON.parse(credsRaw, BufferJSON.reviver) as AuthenticationState['creds'])
    : initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data: Record<string, unknown> = {};

          if (ids.length === 0) {
            return data as Record<string, never>;
          }

          const redisKeys = ids.map((id) => authSignalKey(tenantId, type, id));
          const values = await redis.mget(...redisKeys);

          values.forEach((valueRaw, index) => {
            if (!valueRaw) {
              return;
            }

            const id = ids[index];
            if (!id) {
              return;
            }

            let value = JSON.parse(valueRaw, BufferJSON.reviver) as unknown;
            if (type === 'app-state-sync-key' && value) {
              value = proto.Message.AppStateSyncKeyData.fromObject(value);
            }

            data[id] = value;
          });

          return data as Record<string, never>;
        },

        set: async (data: SignalDataSet) => {
          const pipeline = redis.pipeline();

          for (const category in data) {
            const categoryItems = data[category as keyof SignalDataSet];
            if (!categoryItems) {
              continue;
            }

            for (const id in categoryItems) {
              const value = categoryItems[id];
              const redisKey = authSignalKey(tenantId, category, id);

              if (value) {
                pipeline.set(redisKey, JSON.stringify(value, BufferJSON.replacer));
              } else {
                pipeline.del(redisKey);
              }
            }
          }

          await pipeline.exec();
        },
      },
    },

    saveCreds: async () => {
      await redis.set(authCredsKey(tenantId), JSON.stringify(creds, BufferJSON.replacer));
    },
  };
}
