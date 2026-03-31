import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../shared/middlewares/authenticate.js';
import { resolveTenant } from '../../shared/middlewares/resolveTenant.js';
import { WhatsAppController } from './whatsapp.controller.js';
import { WhatsAppService } from './whatsapp.service.js';

export async function whatsappRoutes(app: FastifyInstance): Promise<void> {
  const guard = [authenticate, resolveTenant];
  const service = new WhatsAppService(app);
  const controller = new WhatsAppController(service);

  app.post('/whatsapp/connect', { preHandler: guard }, controller.connect);
  app.get('/whatsapp/status', { preHandler: guard }, controller.status);
  app.post('/whatsapp/disconnect', { preHandler: guard }, controller.disconnect);
  app.post('/whatsapp/send', { preHandler: guard }, controller.send);
}
