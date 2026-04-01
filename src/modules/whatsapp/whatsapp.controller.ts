import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../shared/errors/appError.js';
import { connectWhatsAppSchema, sendMessageSchema } from './whatsapp.schema.js';
import { WhatsAppService } from './whatsapp.service.js';

export class WhatsAppController {
  constructor(private readonly service: WhatsAppService) {}

  private getTenantId(request: FastifyRequest): string {
    const tenantId = request.authUser?.tenantId;
    if (!tenantId) {
      throw new AppError('Tenant nao resolvido', 403);
    }

    return tenantId;
  }

  connect = async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = this.getTenantId(request);
    const data = connectWhatsAppSchema.parse(request.body ?? {});
    const options = {
      mode: data.mode,
      ...(data.phoneNumber ? { phoneNumber: data.phoneNumber } : {}),
    };
    const result = await this.service.connect(tenantId, options);
    return reply.send(result);
  };

  status = async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = this.getTenantId(request);
    return reply.send(await this.service.status(tenantId));
  };

  disconnect = async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = this.getTenantId(request);
    return reply.send(await this.service.disconnect(tenantId));
  };

  send = async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = this.getTenantId(request);
    const data = sendMessageSchema.parse(request.body);
    const result = await this.service.sendMessage(tenantId, data.to, data.message);
    return reply.send(result);
  };
}
