import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../shared/middlewares/authenticate.js';
import { resolveTenant } from '../../shared/middlewares/resolveTenant.js';

export async function messagesRoutes(app: FastifyInstance): Promise<void> {
  const guard = [authenticate, resolveTenant];

  app.post('/message-templates', { preHandler: guard }, async () => ({ ok: true }));
  app.get('/message-templates', { preHandler: guard }, async () => ({ items: [] }));
  app.get('/message-templates/:id', { preHandler: guard }, async () => ({ ok: true }));
  app.patch('/message-templates/:id', { preHandler: guard }, async () => ({ ok: true }));
  app.delete('/message-templates/:id', { preHandler: guard }, async (_, reply) =>
    reply.status(204).send(),
  );
}
