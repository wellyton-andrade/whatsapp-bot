import type { FastifyReply, FastifyRequest } from 'fastify';
import { TenantsService } from './tenants.service.js';
import { createTenantSchema, tenantIdParamSchema, updateTenantSchema } from './tenants.schema.js';

export class TenantsController {
  constructor(private readonly service: TenantsService) {}

  list = async (_request: FastifyRequest, reply: FastifyReply) => {
    const items = await this.service.list();
    return reply.send({ items });
  };

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = createTenantSchema.parse(request.body);
    const tenant = await this.service.create(data);
    return reply.status(201).send(tenant);
  };

  getById = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = tenantIdParamSchema.parse(request.params);
    const tenant = await this.service.getById(id);

    if (!tenant) {
      return reply.status(404).send({ error: 'Tenant not found' });
    }

    return reply.send(tenant);
  };

  update = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = tenantIdParamSchema.parse(request.params);
    const data = updateTenantSchema.parse(request.body);
    const tenant = await this.service.update(id, data);
    return reply.send(tenant);
  };

  remove = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = tenantIdParamSchema.parse(request.params);
    await this.service.remove(id);
    return reply.status(204).send();
  };
}
