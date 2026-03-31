import type { FastifyReply, FastifyRequest } from 'fastify';
import { MessagesService } from './messages.service.js';

export class MessagesController {
  constructor(private readonly service: MessagesService) {}

  list = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ items: await this.service.list() });
  };
}
