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
  });
});
