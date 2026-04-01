import { describe, expect, test, vi } from 'vitest';
import { authenticate } from '../../../src/shared/middlewares/authenticate';
import { authorizeRoles } from '../../../src/shared/middlewares/authorizeRoles';
import { resolveTenant } from '../../../src/shared/middlewares/resolveTenant';
import { authenticateApiKey } from '../../../src/shared/middlewares/authenticateApiKey';

function createReplyMock() {
  return {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
}

describe('Middlewares Unit Tests', () => {
  test('authenticate should set authUser when jwtVerify succeeds', async () => {
    const request = {
      jwtVerify: vi.fn().mockResolvedValue(undefined),
      user: { userId: 'u1', tenantId: 't1', role: 'ADMIN' },
    } as any;
    const reply = createReplyMock() as any;

    await authenticate(request, reply);

    expect(request.jwtVerify).toHaveBeenCalledTimes(1);
    expect(request.authUser).toEqual({ userId: 'u1', tenantId: 't1', role: 'ADMIN' });
    expect(reply.status).not.toHaveBeenCalled();
  });

  test('authenticate should return 401 when jwtVerify fails', async () => {
    const request = {
      jwtVerify: vi.fn().mockRejectedValue(new Error('token error')),
    } as any;
    const reply = createReplyMock() as any;

    await authenticate(request, reply);

    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });

  test('authorizeRoles should return 401 when authUser is missing', async () => {
    const guard = authorizeRoles(['ADMIN']);
    const request = {} as any;
    const reply = createReplyMock() as any;

    await guard(request, reply);

    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });

  test('authorizeRoles should return 403 when role is not allowed', async () => {
    const guard = authorizeRoles(['ADMIN']);
    const request = { authUser: { role: 'OPERATOR' } } as any;
    const reply = createReplyMock() as any;

    await guard(request, reply);

    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Forbidden' });
  });

  test('authorizeRoles should allow request for permitted role', async () => {
    const guard = authorizeRoles(['ADMIN', 'OPERATOR']);
    const request = { authUser: { role: 'OPERATOR' } } as any;
    const reply = createReplyMock() as any;

    await guard(request, reply);

    expect(reply.status).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });

  test('resolveTenant should return 401 when authUser is missing', async () => {
    const request = {} as any;
    const reply = createReplyMock() as any;

    await resolveTenant(request, reply);

    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });

  test('resolveTenant should return 403 for non-super admin without tenantId', async () => {
    const request = { authUser: { role: 'ADMIN' } } as any;
    const reply = createReplyMock() as any;

    await resolveTenant(request, reply);

    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Tenant not resolved' });
  });

  test('resolveTenant should allow super admin without tenantId', async () => {
    const request = { authUser: { role: 'SUPER_ADMIN' } } as any;
    const reply = createReplyMock() as any;

    await resolveTenant(request, reply);

    expect(reply.status).not.toHaveBeenCalled();
  });

  test('authenticateApiKey should return 401 when x-api-key header is missing', async () => {
    const request = {
      headers: {},
      server: {
        prisma: {
          apiKey: {
            findFirst: vi.fn(),
            update: vi.fn(),
          },
        },
      },
    } as any;
    const reply = createReplyMock() as any;

    await authenticateApiKey(request, reply);

    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({ error: 'API key ausente' });
    expect(request.server.prisma.apiKey.findFirst).not.toHaveBeenCalled();
  });

  test('authenticateApiKey should return 401 when api key is invalid', async () => {
    const request = {
      headers: { 'x-api-key': 'invalid-key' },
      server: {
        prisma: {
          apiKey: {
            findFirst: vi.fn().mockResolvedValue(null),
            update: vi.fn(),
          },
        },
      },
    } as any;
    const reply = createReplyMock() as any;

    await authenticateApiKey(request, reply);

    expect(request.server.prisma.apiKey.findFirst).toHaveBeenCalledTimes(1);
    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({ error: 'API key invalida' });
    expect(request.server.prisma.apiKey.update).not.toHaveBeenCalled();
  });

  test('authenticateApiKey should set authUser and update lastUsedAt for valid key', async () => {
    const request = {
      headers: { 'x-api-key': 'valid-key' },
      server: {
        prisma: {
          apiKey: {
            findFirst: vi.fn().mockResolvedValue({ id: 'key1', tenantId: 'tenant1' }),
            update: vi.fn().mockResolvedValue(undefined),
          },
        },
      },
    } as any;
    const reply = createReplyMock() as any;

    await authenticateApiKey(request, reply);

    expect(request.server.prisma.apiKey.findFirst).toHaveBeenCalledTimes(1);
    expect(request.server.prisma.apiKey.update).toHaveBeenCalledTimes(1);
    expect(request.authUser).toEqual({
      userId: 'api-key:key1',
      tenantId: 'tenant1',
      role: 'ADMIN',
    });
    expect(reply.status).not.toHaveBeenCalled();
  });
});
