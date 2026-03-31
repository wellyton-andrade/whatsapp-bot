import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../shared/middlewares/authenticate.js';
import { resolveTenant } from '../../shared/middlewares/resolveTenant.js';
import { MessagesController } from './messages.controller.js';
import { MessagesService } from './messages.service.js';

export async function messagesRoutes(app: FastifyInstance): Promise<void> {
  const guard = [authenticate, resolveTenant];
  const service = new MessagesService(app);
  const controller = new MessagesController(service);

  app.post('/message-templates', { preHandler: guard }, controller.create);
  app.get('/message-templates', { preHandler: guard }, controller.list);
  app.get('/message-templates/:id', { preHandler: guard }, controller.getById);
  app.patch('/message-templates/:id', { preHandler: guard }, controller.update);
  app.delete('/message-templates/:id', { preHandler: guard }, controller.remove);
}
