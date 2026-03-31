import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  SERVER_URL: z.url().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().default('*'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN_DAYS: z.coerce.number().int().positive().default(30),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const issues = parsedEnv.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  throw new Error(`Variaveis de ambiente invalidas:\n${issues.join('\n')}`);
}

export const env = parsedEnv.data;

export function getCorsOrigins(): true | string[] {
  if (env.CORS_ORIGINS === '*') {
    return true;
  }

  return env.CORS_ORIGINS.split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}
