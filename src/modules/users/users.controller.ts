import type { FastifyReply, FastifyRequest } from 'fastify';
import { UsersService } from './users.service.js';
import { createUserSchema, updatePasswordSchema, updateProfileSchema } from './users.schema.js';

export class UsersController {
  constructor(private readonly service: UsersService) {}

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = createUserSchema.parse(request.body);
    const user = await this.service.create(data);
    return reply.status(201).send(user);
  };

  me = async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.authUser?.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const user = await this.service.getById(userId);
    return reply.send({ user });
  };

  updateProfile = async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.authUser?.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const data = updateProfileSchema.parse(request.body);
    const user = await this.service.updateProfile(userId, data);
    return reply.send({ user });
  };

  updatePassword = async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.authUser?.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const data = updatePasswordSchema.parse(request.body);
    await this.service.updatePassword(userId, data.currentPassword, data.newPassword);
    return reply.status(204).send();
  };
}
