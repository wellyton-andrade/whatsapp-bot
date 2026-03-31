import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { AppError } from '../../shared/errors/appError.js';
import { comparePassword, hashPassword } from '../../shared/utils/hash.js';
import type { CreateUserInput, UpdateProfileInput } from './users.schema.js';

export class UsersService {
  constructor(private readonly app: FastifyInstance) {}

  async getById(userId: string) {
    return this.app.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        tenantId: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async create(data: CreateUserInput) {
    const payload: Prisma.UserUncheckedCreateInput = {
      tenantId: data.tenantId ?? null,
      name: data.name,
      email: data.email,
      passwordHash: await hashPassword(data.password),
      ...(data.role !== undefined ? { role: data.role } : {}),
      ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    };

    return this.app.prisma.user.create({
      data: payload,
      select: {
        id: true,
        tenantId: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async updateProfile(userId: string, data: UpdateProfileInput) {
    const payload: Prisma.UserUpdateInput = {};

    if (data.name !== undefined) payload.name = data.name;
    if (data.avatarUrl !== undefined) payload.avatarUrl = data.avatarUrl;

    return this.app.prisma.user.update({
      where: { id: userId },
      data: payload,
      select: {
        id: true,
        tenantId: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  async updatePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.app.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const passwordOk = await comparePassword(currentPassword, user.passwordHash);
    if (!passwordOk) {
      throw new AppError('Senha atual invalida', 401);
    }

    await this.app.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(newPassword) },
    });
  }
}
