import type { FastifyInstance } from 'fastify';
import type {
  CreateFlowInput,
  CreateStepInput,
  UpdateFlowInput,
  UpdateStepInput,
} from './flows.schema.js';

export class FlowsService {
  constructor(private readonly app: FastifyInstance) {}

  async list(tenantId: string) {
    return this.app.prisma.flow.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: {
            steps: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(tenantId: string, data: CreateFlowInput) {
    return this.app.prisma.flow.create({
      data: {
        tenantId,
        name: data.name,
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.triggerType !== undefined ? { triggerType: data.triggerType } : {}),
        ...(data.triggerValue !== undefined ? { triggerValue: data.triggerValue } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  async getById(tenantId: string, id: string) {
    return this.app.prisma.flow.findFirst({
      where: { id, tenantId },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  async update(tenantId: string, id: string, data: UpdateFlowInput) {
    return this.app.prisma.flow.updateMany({
      where: { id, tenantId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.triggerType !== undefined ? { triggerType: data.triggerType } : {}),
        ...(data.triggerValue !== undefined ? { triggerValue: data.triggerValue } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.app.prisma.flow.deleteMany({ where: { id, tenantId } });
  }

  async activate(tenantId: string, id: string) {
    await this.app.prisma.$transaction([
      this.app.prisma.flow.updateMany({
        where: { tenantId },
        data: { isActive: false },
      }),
      this.app.prisma.flow.updateMany({
        where: { tenantId, id },
        data: { isActive: true },
      }),
    ]);
  }

  async listSteps(tenantId: string, flowId: string) {
    return this.app.prisma.flowStep.findMany({
      where: {
        flowId,
        flow: { tenantId },
      },
      orderBy: { order: 'asc' },
    });
  }

  async createStep(tenantId: string, flowId: string, data: CreateStepInput) {
    const flow = await this.app.prisma.flow.findFirst({ where: { id: flowId, tenantId } });
    if (!flow) {
      return null;
    }

    return this.app.prisma.flowStep.create({
      data: {
        flowId,
        order: data.order,
        ...(data.templateId !== undefined ? { templateId: data.templateId } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.inputVariable !== undefined ? { inputVariable: data.inputVariable } : {}),
        ...(data.validationRegex !== undefined ? { validationRegex: data.validationRegex } : {}),
        ...(data.invalidMessage !== undefined ? { invalidMessage: data.invalidMessage } : {}),
        ...(data.waitForInput !== undefined ? { waitForInput: data.waitForInput } : {}),
        ...(data.nextStepId !== undefined ? { nextStepId: data.nextStepId } : {}),
      },
    });
  }

  async updateStep(tenantId: string, flowId: string, stepId: string, data: UpdateStepInput) {
    const flow = await this.app.prisma.flow.findFirst({ where: { id: flowId, tenantId } });
    if (!flow) {
      return 0;
    }

    const result = await this.app.prisma.flowStep.updateMany({
      where: { id: stepId, flowId },
      data: {
        ...(data.order !== undefined ? { order: data.order } : {}),
        ...(data.templateId !== undefined ? { templateId: data.templateId } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.inputVariable !== undefined ? { inputVariable: data.inputVariable } : {}),
        ...(data.validationRegex !== undefined ? { validationRegex: data.validationRegex } : {}),
        ...(data.invalidMessage !== undefined ? { invalidMessage: data.invalidMessage } : {}),
        ...(data.waitForInput !== undefined ? { waitForInput: data.waitForInput } : {}),
        ...(data.nextStepId !== undefined ? { nextStepId: data.nextStepId } : {}),
      },
    });

    return result.count;
  }

  async removeStep(tenantId: string, flowId: string, stepId: string) {
    const flow = await this.app.prisma.flow.findFirst({ where: { id: flowId, tenantId } });
    if (!flow) {
      return;
    }

    await this.app.prisma.flowStep.deleteMany({ where: { id: stepId, flowId } });
  }
}
