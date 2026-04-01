import type { FastifyReply, FastifyRequest } from 'fastify';

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authorizationHeader = request.headers.authorization;
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    reply.status(401).send({ error: 'Unauthorized' });
    return;
  }

  try {
    await request.jwtVerify<{
      userId: string;
      tenantId?: string;
      role: 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR';
    }>();

    request.authUser = request.user as {
      userId: string;
      tenantId?: string;
      role: 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR';
    };
  } catch (error) {
    request.log.warn({ err: error, requestId: request.id }, 'jwt verification failed');
    reply.status(401).send({ error: 'Unauthorized' });
  }
}
