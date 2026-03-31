import type { FastifyInstance } from 'fastify';
import type { CreateTemplateInput, UpdateTemplateInput } from './messages.schema.js';

export class MessagesService {
  constructor(private readonly app: FastifyInstance) {}

  async list(tenantId: string) {
    return this.app.prisma.messageTemplate.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(tenantId: string, data: CreateTemplateInput) {
    return this.app.prisma.messageTemplate.create({
      data: {
        tenantId,
        name: data.name,
        content: data.content,
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.mediaUrl !== undefined ? { mediaUrl: data.mediaUrl } : {}),
        ...(data.caption !== undefined ? { caption: data.caption } : {}),
        ...(data.buttons !== undefined ? { buttons: data.buttons } : {}),
        ...(data.listTitle !== undefined ? { listTitle: data.listTitle } : {}),
        ...(data.listItems !== undefined ? { listItems: data.listItems } : {}),
      },
    });
  }

  async getById(tenantId: string, id: string) {
    return this.app.prisma.messageTemplate.findFirst({
      where: { id, tenantId },
    });
  }

  async update(tenantId: string, id: string, data: UpdateTemplateInput) {
    return this.app.prisma.messageTemplate.updateMany({
      where: { id, tenantId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.content !== undefined ? { content: data.content } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.mediaUrl !== undefined ? { mediaUrl: data.mediaUrl } : {}),
        ...(data.caption !== undefined ? { caption: data.caption } : {}),
        ...(data.buttons !== undefined ? { buttons: data.buttons } : {}),
        ...(data.listTitle !== undefined ? { listTitle: data.listTitle } : {}),
        ...(data.listItems !== undefined ? { listItems: data.listItems } : {}),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.app.prisma.messageTemplate.deleteMany({
      where: { id, tenantId },
    });
  }
}
