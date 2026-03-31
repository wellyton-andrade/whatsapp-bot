import type { FastifyReply, FastifyRequest } from 'fastify';

export async function resolveTenant(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.authUser) {
    reply.status(401).send({ error: 'Unauthorized' });
    return;
  }

  if (!request.authUser.tenantId && request.authUser.role !== 'SUPER_ADMIN') {
    reply.status(403).send({ error: 'Tenant not resolved' });
    return;
  }
}
