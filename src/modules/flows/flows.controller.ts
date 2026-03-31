import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../shared/errors/appError.js';
import {
  createFlowSchema,
  createStepSchema,
  flowIdParamSchema,
  flowOnlyParamSchema,
  flowStepParamSchema,
  updateFlowSchema,
  updateStepSchema,
} from './flows.schema.js';
import { FlowsService } from './flows.service.js';

export class FlowsController {
  constructor(private readonly service: FlowsService) {}

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
    const data = createFlowSchema.parse(request.body);
    const flow = await this.service.create(tenantId, data);
    return reply.status(201).send(flow);
  };

  getById = async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = this.getTenantId(request);
    const { id } = flowIdParamSchema.parse(request.params);
    const flow = await this.service.getById(tenantId, id);

    if (!flow) {
      return reply.status(404).send({ error: 'Flow not found' });
    }

    return reply.send(flow);
  };

  update = async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = this.getTenantId(request);
    const { id } = flowIdParamSchema.parse(request.params);
    const data = updateFlowSchema.parse(request.body);
    const result = await this.service.update(tenantId, id, data);

    if (result.count === 0) {
      return reply.status(404).send({ error: 'Flow not found' });
    }

    const flow = await this.service.getById(tenantId, id);
    return reply.send(flow);
  };

  remove = async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = this.getTenantId(request);
    const { id } = flowIdParamSchema.parse(request.params);
    await this.service.remove(tenantId, id);
    return reply.status(204).send();
  };

  activate = async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = this.getTenantId(request);
    const { id } = flowIdParamSchema.parse(request.params);
    await this.service.activate(tenantId, id);
    return reply.status(204).send();
  };

  listSteps = async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = this.getTenantId(request);
    const { flowId } = flowOnlyParamSchema.parse(request.params);
    const items = await this.service.listSteps(tenantId, flowId);
    return reply.send({ items });
  };

  createStep = async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = this.getTenantId(request);
    const { flowId } = flowOnlyParamSchema.parse(request.params);
    const data = createStepSchema.parse(request.body);
    const step = await this.service.createStep(tenantId, flowId, data);

    if (!step) {
      return reply.status(404).send({ error: 'Flow not found' });
    }

    return reply.status(201).send(step);
  };

  updateStep = async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = this.getTenantId(request);
    const { flowId, stepId } = flowStepParamSchema.parse(request.params);
    const data = updateStepSchema.parse(request.body);
    const count = await this.service.updateStep(tenantId, flowId, stepId, data);

    if (count === 0) {
      return reply.status(404).send({ error: 'Step not found' });
    }

    const steps = await this.service.listSteps(tenantId, flowId);
    const step = steps.find((item) => item.id === stepId);
    return reply.send(step);
  };

  removeStep = async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = this.getTenantId(request);
    const { flowId, stepId } = flowStepParamSchema.parse(request.params);
    await this.service.removeStep(tenantId, flowId, stepId);
    return reply.status(204).send();
  };
}
