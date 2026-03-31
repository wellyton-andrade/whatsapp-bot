import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { UserRole, type PrismaClient } from '@prisma/client';
import { buildApp } from '../../src/app';
import { hashPassword } from '../../src/shared/utils/hash';

type TestApp = Awaited<ReturnType<typeof buildApp>> & {
  prisma: PrismaClient;
};

describe('Auth Integration Tests', () => {
  let app: TestApp;
  let createdTenantId: string;
  const email = `auth.test.${Date.now()}@example.com`;
  const password = '12345678';

  beforeAll(async () => {
    app = (await buildApp({ logger: false, enableQueue: false })) as TestApp;

    const tenant = await app.prisma.tenant.create({
      data: {
        name: 'Tenant Auth Test',
        slug: `tenant-auth-${Date.now()}`,
        email: `tenant.auth.${Date.now()}@example.com`,
      },
    });

    createdTenantId = tenant.id;

    await app.prisma.user.create({
      data: {
        tenantId: tenant.id,
        name: 'Auth Tester',
        email,
        passwordHash: await hashPassword(password),
        role: UserRole.ADMIN,
      },
    });
  });

  afterAll(async () => {
    await app.prisma.tenant.deleteMany({ where: { id: createdTenantId } });
    await app.close();
  });

  test('should login, refresh and logout using refresh token cookie', async () => {
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email,
        password,
      },
    });

    expect(loginResponse.statusCode).toBe(200);
    const loginBody = loginResponse.json<{ accessToken: string }>();
    expect(typeof loginBody.accessToken).toBe('string');
    expect(loginBody.accessToken.length).toBeGreaterThan(20);

    const loginCookies = loginResponse.cookies;
    const refreshCookie = loginCookies.find((cookie) => cookie.name === 'refreshToken');
    expect(refreshCookie).toBeDefined();

    const refreshResponse = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: {
        cookie: `refreshToken=${refreshCookie?.value ?? ''}`,
      },
    });

    expect(refreshResponse.statusCode).toBe(200);
    const refreshBody = refreshResponse.json<{ accessToken: string }>();
    expect(typeof refreshBody.accessToken).toBe('string');

    const refreshedCookie = refreshResponse.cookies.find(
      (cookie) => cookie.name === 'refreshToken',
    );
    expect(refreshedCookie).toBeDefined();

    const logoutResponse = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: {
        cookie: `refreshToken=${refreshedCookie?.value ?? ''}`,
      },
    });

    expect(logoutResponse.statusCode).toBe(204);
  });

  test('should reject invalid credentials', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email,
        password: 'wrong-password',
      },
    });

    expect(response.statusCode).toBe(401);
  });
});
