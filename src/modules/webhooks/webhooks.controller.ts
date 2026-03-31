import type { FastifyReply, FastifyRequest } from 'fastify';
import { WebhooksService } from './webhooks.service.js';

export class WebhooksController {
  constructor(private readonly service: WebhooksService) {}

  list = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ items: await this.service.list() });
  };
}
