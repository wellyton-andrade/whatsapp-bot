import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../shared/middlewares/authenticate.js';
import { resolveTenant } from '../../shared/middlewares/resolveTenant.js';

export async function flowsRoutes(app: FastifyInstance): Promise<void> {
  const guard = [authenticate, resolveTenant];

  app.post('/flows', { preHandler: guard }, async () => ({ ok: true }));
  app.get('/flows', { preHandler: guard }, async () => ({ items: [] }));
  app.get('/flows/:id', { preHandler: guard }, async () => ({ ok: true }));
  app.patch('/flows/:id', { preHandler: guard }, async () => ({ ok: true }));
  app.delete('/flows/:id', { preHandler: guard }, async (_, reply) => reply.status(204).send());
  app.post('/flows/:id/activate', { preHandler: guard }, async () => ({ ok: true }));

  app.post('/flows/:flowId/steps', { preHandler: guard }, async () => ({ ok: true }));
  app.get('/flows/:flowId/steps', { preHandler: guard }, async () => ({ items: [] }));
  app.patch('/flows/:flowId/steps/:stepId', { preHandler: guard }, async () => ({ ok: true }));
  app.delete('/flows/:flowId/steps/:stepId', { preHandler: guard }, async (_, reply) =>
    reply.status(204).send(),
  );
}
