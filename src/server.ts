import { env } from './config/env.js';
import { buildApp } from './app.js';

type BuildServerOptions = {
  logger?: boolean;
  enableQueue?: boolean;
};

export async function buildServer(options: BuildServerOptions = {}) {
  return buildApp(options);
}

export async function startServer(): Promise<void> {
  const app = await buildServer();

  try {
    await app.listen({
      host: env.HOST,
      port: env.PORT,
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  void startServer();
}
