import type { FastifyReply, FastifyRequest } from 'fastify';
import { FlowsService } from './flows.service.js';

export class FlowsController {
  constructor(private readonly service: FlowsService) {}

  list = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ items: await this.service.list() });
  };
}
