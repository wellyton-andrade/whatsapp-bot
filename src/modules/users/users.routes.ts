import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../shared/middlewares/authenticate.js';
import { authorizeRoles } from '../../shared/middlewares/authorizeRoles.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

export async function usersRoutes(app: FastifyInstance): Promise<void> {
  const service = new UsersService(app);
  const controller = new UsersController(service);

  app.post(
    '/users',
    { preHandler: [authenticate, authorizeRoles(['SUPER_ADMIN', 'ADMIN'])] },
    controller.create,
  );
  app.get('/users/me', { preHandler: [authenticate] }, controller.me);
  app.patch('/users/me', { preHandler: [authenticate] }, controller.updateProfile);
  app.patch('/users/me/password', { preHandler: [authenticate] }, controller.updatePassword);
}
