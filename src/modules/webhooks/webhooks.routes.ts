import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../shared/middlewares/authenticate.js';
import { resolveTenant } from '../../shared/middlewares/resolveTenant.js';

export async function webhooksRoutes(app: FastifyInstance): Promise<void> {
  const guard = [authenticate, resolveTenant];

  app.post('/webhooks', { preHandler: guard }, async () => ({ ok: true }));
  app.get('/webhooks', { preHandler: guard }, async () => ({ items: [] }));
  app.get('/webhooks/:id', { preHandler: guard }, async () => ({ ok: true }));
  app.patch('/webhooks/:id', { preHandler: guard }, async () => ({ ok: true }));
  app.delete('/webhooks/:id', { preHandler: guard }, async (_, reply) => reply.status(204).send());
}
