import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../shared/middlewares/authenticate.js';
import { resolveTenant } from '../../shared/middlewares/resolveTenant.js';

export async function whatsappRoutes(app: FastifyInstance): Promise<void> {
  const guard = [authenticate, resolveTenant];

  app.post('/whatsapp/connect', { preHandler: guard }, async () => ({ status: 'pending_qr' }));
  app.get('/whatsapp/status', { preHandler: guard }, async () => ({ status: 'disconnected' }));
  app.post('/whatsapp/disconnect', { preHandler: guard }, async () => ({ status: 'disconnected' }));
  app.post('/whatsapp/send', { preHandler: guard }, async () => ({ queued: true }));
}
