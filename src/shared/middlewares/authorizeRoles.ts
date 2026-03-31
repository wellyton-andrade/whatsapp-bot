import type { FastifyReply, FastifyRequest } from 'fastify';

type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR';

export function authorizeRoles(allowedRoles: UserRole[]) {
  return async function authorize(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!request.authUser) {
      reply.status(401).send({ error: 'Unauthorized' });
      return;
    }

    if (!allowedRoles.includes(request.authUser.role)) {
      reply.status(403).send({ error: 'Forbidden' });
    }
  };
}
