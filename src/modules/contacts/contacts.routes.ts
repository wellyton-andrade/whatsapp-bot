import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../shared/middlewares/authenticate.js';
import { resolveTenant } from '../../shared/middlewares/resolveTenant.js';
import { ContactsController } from './contacts.controller.js';
import { ContactsService } from './contacts.service.js';

export async function contactsRoutes(app: FastifyInstance): Promise<void> {
  const guard = [authenticate, resolveTenant];
  const service = new ContactsService(app);
  const controller = new ContactsController(service);

  app.get('/contacts', { preHandler: guard }, controller.list);
  app.get('/contacts/:id', { preHandler: guard }, controller.getById);
  app.get('/contacts/:id/history', { preHandler: guard }, controller.getHistory);
  app.delete('/contacts/:id', { preHandler: guard }, controller.remove);
}
