import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../../config/env.js';
import { AuthService } from './auth.service.js';
import { loginSchema, refreshSchema } from './auth.schema.js';

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  login = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = loginSchema.parse(request.body);
    const result = await this.authService.login(data);

    reply.setCookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      path: '/auth',
      maxAge: env.JWT_REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60,
    });

    return reply.send({
      accessToken: result.accessToken,
      user: result.user,
    });
  };

  refresh = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = refreshSchema.parse(request.body ?? {});
    const cookieToken = request.cookies.refreshToken;
    const refreshToken = parsed.refreshToken ?? cookieToken;

    if (!refreshToken) {
      return reply.status(401).send({ error: 'Refresh token ausente' });
    }

    const result = await this.authService.refresh(refreshToken);

    reply.setCookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      path: '/auth',
      maxAge: env.JWT_REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60,
    });

    return reply.send({ accessToken: result.accessToken });
  };

  logout = async (request: FastifyRequest, reply: FastifyReply) => {
    const refreshToken = request.cookies.refreshToken;

    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    reply.clearCookie('refreshToken', { path: '/auth' });
    return reply.status(204).send();
  };
}
