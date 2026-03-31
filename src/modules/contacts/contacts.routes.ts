import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../shared/middlewares/authenticate.js';
import { resolveTenant } from '../../shared/middlewares/resolveTenant.js';

export async function contactsRoutes(app: FastifyInstance): Promise<void> {
  const guard = [authenticate, resolveTenant];

  app.get('/contacts', { preHandler: guard }, async () => ({ items: [] }));
  app.get('/contacts/:id', { preHandler: guard }, async () => ({ ok: true }));
  app.delete('/contacts/:id', { preHandler: guard }, async (_, reply) => reply.status(204).send());
}
