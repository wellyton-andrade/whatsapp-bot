import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../shared/errors/appError.js';
import { contactIdParamSchema, contactsQuerySchema } from './contacts.schema.js';
import { ContactsService } from './contacts.service.js';

export class ContactsController {
  constructor(private readonly service: ContactsService) {}

  private getTenantId(request: FastifyRequest): string {
    const tenantId = request.authUser?.tenantId;
    if (!tenantId) {
      throw new AppError('Tenant nao resolvido', 403);
    }

    return tenantId;
  }

  list = async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = this.getTenantId(request);
    const { search } = contactsQuerySchema.parse(request.query ?? {});
    const items = await this.service.list(tenantId, search);
    return reply.send({ items });
  };

  getById = async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = this.getTenantId(request);
    const { id } = contactIdParamSchema.parse(request.params);
    const contact = await this.service.getById(tenantId, id);

    if (!contact) {
      return reply.status(404).send({ error: 'Contact not found' });
    }

    return reply.send(contact);
  };

  getHistory = async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = this.getTenantId(request);
    const { id } = contactIdParamSchema.parse(request.params);

    const contact = await this.service.getById(tenantId, id);
    if (!contact) {
      return reply.status(404).send({ error: 'Contact not found' });
    }

    const conversations = await this.service.getHistory(tenantId, id);
    return reply.send({ contact, conversations });
  };

  remove = async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = this.getTenantId(request);
    const { id } = contactIdParamSchema.parse(request.params);
    await this.service.remove(tenantId, id);
    return reply.status(204).send();
  };
}
