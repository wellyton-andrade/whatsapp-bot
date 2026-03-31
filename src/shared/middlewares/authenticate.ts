import type { FastifyReply, FastifyRequest } from 'fastify';

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
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
  } catch {
    reply.status(401).send({ error: 'Unauthorized' });
  }
}
