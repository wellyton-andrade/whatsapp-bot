import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../shared/middlewares/authenticate.js';
import { resolveTenant } from '../../shared/middlewares/resolveTenant.js';
import { FlowsController } from './flows.controller.js';
import { FlowsService } from './flows.service.js';

export async function flowsRoutes(app: FastifyInstance): Promise<void> {
  const guard = [authenticate, resolveTenant];
  const service = new FlowsService(app);
  const controller = new FlowsController(service);

  app.post('/flows', { preHandler: guard }, controller.create);
  app.get('/flows', { preHandler: guard }, controller.list);
  app.get('/flows/:id', { preHandler: guard }, controller.getById);
  app.patch('/flows/:id', { preHandler: guard }, controller.update);
  app.delete('/flows/:id', { preHandler: guard }, controller.remove);
  app.post('/flows/:id/activate', { preHandler: guard }, controller.activate);

  app.post('/flows/:flowId/steps', { preHandler: guard }, controller.createStep);
  app.get('/flows/:flowId/steps', { preHandler: guard }, controller.listSteps);
  app.patch('/flows/:flowId/steps/:stepId', { preHandler: guard }, controller.updateStep);
  app.delete('/flows/:flowId/steps/:stepId', { preHandler: guard }, controller.removeStep);
}
