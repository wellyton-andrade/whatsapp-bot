import type { FastifyInstance } from 'fastify';

export class ContactsService {
  constructor(private readonly app: FastifyInstance) {}

  async list(tenantId: string, search?: string) {
    return this.app.prisma.contact.findMany({
      where: {
        tenantId,
        ...(search
          ? {
              OR: [
                { phone: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        _count: {
          select: {
            conversations: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getById(tenantId: string, id: string) {
    return this.app.prisma.contact.findFirst({
      where: { id, tenantId },
    });
  }

  async getHistory(tenantId: string, id: string) {
    return this.app.prisma.conversation.findMany({
      where: { tenantId, contactId: id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.app.prisma.contact.deleteMany({
      where: { id, tenantId },
    });
  }
}
