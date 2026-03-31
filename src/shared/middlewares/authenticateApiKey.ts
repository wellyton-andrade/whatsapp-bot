import { createHmac } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../../config/env.js';

function hashApiKey(rawKey: string): string {
  return createHmac('sha256', env.JWT_SECRET).update(rawKey).digest('hex');
}

export async function authenticateApiKey(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const apiKeyHeader = request.headers['x-api-key'];

  if (!apiKeyHeader || typeof apiKeyHeader !== 'string') {
    reply.status(401).send({ error: 'API key ausente' });
    return;
  }

  const apiKey = await request.server.prisma.apiKey.findFirst({
    where: {
      keyHash: hashApiKey(apiKeyHeader),
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });

  if (!apiKey) {
    reply.status(401).send({ error: 'API key invalida' });
    return;
  }

  await request.server.prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  request.authUser = {
    userId: `api-key:${apiKey.id}`,
    tenantId: apiKey.tenantId,
    role: 'ADMIN',
  };
}
