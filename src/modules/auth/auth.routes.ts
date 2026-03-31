import type { FastifyInstance } from 'fastify';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const service = new AuthService(app);
  const controller = new AuthController(service);

  app.post('/auth/login', controller.login);
  app.post('/auth/refresh', controller.refresh);
  app.post('/auth/logout', controller.logout);
}
