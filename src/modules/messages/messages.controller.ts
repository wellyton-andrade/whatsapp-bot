import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../shared/errors/appError.js';
import {
  createTemplateSchema,
  templateIdParamSchema,
  updateTemplateSchema,
} from './messages.schema.js';
import { MessagesService } from './messages.service.js';

export class MessagesController {
  constructor(private readonly service: MessagesService) {}

  private getTenantId(request: FastifyRequest): string {
    const tenantId = request.authUser?.tenantId;
    if (!tenantId) {
      throw new AppError('Tenant nao resolvido', 403);
    }

    return tenantId;
  }

  list = async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = this.getTenantId(request);
    const items = await this.service.list(tenantId);
    return reply.send({ items });
  };

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = this.getTenantId(request);
    const data = createTemplateSchema.parse(request.body);
    const template = await this.service.create(tenantId, data);
    return reply.status(201).send(template);
  };

  getById = async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = this.getTenantId(request);
    const { id } = templateIdParamSchema.parse(request.params);
    const template = await this.service.getById(tenantId, id);

    if (!template) {
      return reply.status(404).send({ error: 'Template not found' });
    }

    return reply.send(template);
  };

  update = async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = this.getTenantId(request);
    const { id } = templateIdParamSchema.parse(request.params);
    const data = updateTemplateSchema.parse(request.body);
    const result = await this.service.update(tenantId, id, data);

    if (result.count === 0) {
      return reply.status(404).send({ error: 'Template not found' });
    }

    const template = await this.service.getById(tenantId, id);
    return reply.send(template);
  };

  remove = async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = this.getTenantId(request);
    const { id } = templateIdParamSchema.parse(request.params);
    await this.service.remove(tenantId, id);
    return reply.status(204).send();
  };
}
