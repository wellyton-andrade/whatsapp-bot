import { createHash, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import dayjs from 'dayjs';
import { comparePassword } from '../../shared/utils/hash.js';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/appError.js';
import type { LoginInput } from './auth.schema.js';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export class AuthService {
  constructor(private readonly app: FastifyInstance) {}

  async login(data: LoginInput) {
    const user = await this.app.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user || !user.isActive) {
      throw new AppError('Credenciais invalidas', 401);
    }

    const passwordOk = await comparePassword(data.password, user.passwordHash);
    if (!passwordOk) {
      throw new AppError('Credenciais invalidas', 401);
    }

    const accessToken = this.app.jwt.sign(
      { userId: user.id, tenantId: user.tenantId ?? undefined, role: user.role },
      { expiresIn: env.JWT_EXPIRES_IN },
    );

    const refreshTokenRaw = randomUUID();

    await this.app.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshTokenRaw),
        expiresAt: dayjs().add(env.JWT_REFRESH_EXPIRES_IN_DAYS, 'day').toDate(),
      },
    });

    await this.app.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      accessToken,
      refreshToken: refreshTokenRaw,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
    };
  }

  async refresh(refreshTokenRaw: string) {
    const token = await this.app.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(refreshTokenRaw) },
      include: { user: true },
    });

    if (!token || token.revokedAt || token.usedAt || token.expiresAt < new Date()) {
      throw new AppError('Refresh token invalido', 401);
    }

    await this.app.prisma.refreshToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    });

    const nextRefreshRaw = randomUUID();
    await this.app.prisma.refreshToken.create({
      data: {
        userId: token.user.id,
        tokenHash: sha256(nextRefreshRaw),
        expiresAt: dayjs().add(env.JWT_REFRESH_EXPIRES_IN_DAYS, 'day').toDate(),
      },
    });

    const accessToken = this.app.jwt.sign(
      { userId: token.user.id, tenantId: token.user.tenantId ?? undefined, role: token.user.role },
      { expiresIn: env.JWT_EXPIRES_IN },
    );

    return { accessToken, refreshToken: nextRefreshRaw };
  }

  async logout(refreshTokenRaw: string) {
    await this.app.prisma.refreshToken.updateMany({
      where: {
        tokenHash: sha256(refreshTokenRaw),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }
}
