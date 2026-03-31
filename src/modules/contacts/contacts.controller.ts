import type { FastifyReply, FastifyRequest } from 'fastify';
import { ContactsService } from './contacts.service.js';

export class ContactsController {
  constructor(private readonly service: ContactsService) {}

  list = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ items: await this.service.list() });
  };
}
