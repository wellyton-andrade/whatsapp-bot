import { test, afterAll, beforeAll, describe, expect } from 'vitest';
import { buildApp } from '../../src/app';

describe('Server Integration Tests', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({ logger: false, enableQueue: false });
  });

  afterAll(async () => {
    await app.close();
  });

  test('block requests after hitting the limit', async () => {
    for (let i = 0; i < 100; i++) {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
    }

    const blockedResponse = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(blockedResponse.statusCode).toBe(429);
  });
});
