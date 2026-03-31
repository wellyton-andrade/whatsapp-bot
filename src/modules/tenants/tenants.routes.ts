import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../shared/middlewares/authenticate.js';
import { authorizeRoles } from '../../shared/middlewares/authorizeRoles.js';
import { TenantsController } from './tenants.controller.js';
import { TenantsService } from './tenants.service.js';

export async function tenantsRoutes(app: FastifyInstance): Promise<void> {
  const service = new TenantsService(app);
  const controller = new TenantsController(service);
  const guard = [authenticate, authorizeRoles(['SUPER_ADMIN'])];

  app.post('/tenants', { preHandler: guard }, controller.create);
  app.get('/tenants', { preHandler: guard }, controller.list);
  app.get('/tenants/:id', { preHandler: guard }, controller.getById);
  app.patch('/tenants/:id', { preHandler: guard }, controller.update);
  app.delete('/tenants/:id', { preHandler: guard }, controller.remove);
}
