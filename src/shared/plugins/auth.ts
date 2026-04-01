import fp from 'fastify-plugin';
import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt';
import { env } from '../../config/env.js';

export const authPlugin = fp(async (app) => {
  await app.register(fastifyCookie, {
    secret: env.JWT_SECRET,
  });

  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    cookie: {
      cookieName: 'refreshToken',
      signed: false,
    },
    sign: {
      algorithm: 'HS256',
      iss: env.JWT_ISSUER,
      aud: env.JWT_AUDIENCE,
    },
    verify: {
      algorithms: ['HS256'],
      allowedIss: env.JWT_ISSUER,
      allowedAud: env.JWT_AUDIENCE,
    },
  });
});
