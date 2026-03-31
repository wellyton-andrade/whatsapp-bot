import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../shared/errors/appError.js';
import {
  createApiKeySchema,
  createWebhookSchema,
  testWebhookSchema,
  updateWebhookSchema,
  webhookIdParamSchema,
} from './webhooks.schema.js';
import { WebhooksService } from './webhooks.service.js';

export class WebhooksController {
  constructor(private readonly service: WebhooksService) {}

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
    const data = createWebhookSchema.parse(request.body);
    const webhook = await this.service.create(tenantId, data);
    return reply.status(201).send(webhook);
  };

  getById = async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = this.getTenantId(request);
    const { id } = webhookIdParamSchema.parse(request.params);
    const webhook = await this.service.getById(tenantId, id);

    if (!webhook) {
      return reply.status(404).send({ error: 'Webhook not found' });
    }

    return reply.send(webhook);
  };

  update = async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = this.getTenantId(request);
    const { id } = webhookIdParamSchema.parse(request.params);
    const data = updateWebhookSchema.parse(request.body);
    const result = await this.service.update(tenantId, id, data);

    if (result.count === 0) {
      return reply.status(404).send({ error: 'Webhook not found' });
    }

    const webhook = await this.service.getById(tenantId, id);
    return reply.send(webhook);
  };

  remove = async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = this.getTenantId(request);
    const { id } = webhookIdParamSchema.parse(request.params);
    await this.service.remove(tenantId, id);
    return reply.status(204).send();
  };

  test = async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = this.getTenantId(request);
    const { id } = webhookIdParamSchema.parse(request.params);
    const data = testWebhookSchema.parse(request.body ?? {});
    const result = await this.service.dispatchTest(tenantId, id, data);

    if (!result) {
      return reply.status(404).send({ error: 'Webhook not found or inactive' });
    }

    return reply.send(result);
  };

  createApiKey = async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = this.getTenantId(request);
    const data = createApiKeySchema.parse(request.body);
    const apiKey = await this.service.createApiKey(tenantId, data);
    return reply.status(201).send(apiKey);
  };

  listApiKeys = async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = this.getTenantId(request);
    const items = await this.service.listApiKeys(tenantId);
    return reply.send({ items });
  };
}
