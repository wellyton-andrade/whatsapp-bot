import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import type { CreateTenantInput, UpdateTenantInput } from './tenants.schema.js';

export class TenantsService {
  constructor(private readonly app: FastifyInstance) {}

  async list() {
    return this.app.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: CreateTenantInput) {
    const payload: Prisma.TenantCreateInput = {
      name: data.name,
      slug: data.slug,
      email: data.email,
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.logoUrl !== undefined ? { logoUrl: data.logoUrl } : {}),
      ...(data.plan !== undefined ? { plan: data.plan } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    };

    return this.app.prisma.tenant.create({
      data: payload,
    });
  }

  async getById(id: string) {
    return this.app.prisma.tenant.findUnique({ where: { id } });
  }

  async update(id: string, data: UpdateTenantInput) {
    const payload: Prisma.TenantUpdateInput = {};

    if (data.name !== undefined) payload.name = data.name;
    if (data.slug !== undefined) payload.slug = data.slug;
    if (data.email !== undefined) payload.email = data.email;
    if (data.phone !== undefined) payload.phone = data.phone;
    if (data.logoUrl !== undefined) payload.logoUrl = data.logoUrl;
    if (data.plan !== undefined) payload.plan = data.plan;
    if (data.isActive !== undefined) payload.isActive = data.isActive;

    return this.app.prisma.tenant.update({
      where: { id },
      data: payload,
    });
  }

  async remove(id: string) {
    await this.app.prisma.tenant.delete({ where: { id } });
  }
}
