import type { FastifyReply, FastifyRequest } from 'fastify';
import { WhatsAppService } from './whatsapp.service.js';

export class WhatsAppController {
  constructor(private readonly service: WhatsAppService) {}

  status = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await this.service.status());
  };
}
