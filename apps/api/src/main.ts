import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { configureApp } from './configure-app.js';
import type { Env } from './core/config/env.schema.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule.register(), {
    bufferLogs: true,
    // With abortOnError false the catch below reports startup errors (e.g. invalid env)
    abortOnError: false,
  });
  app.useLogger(app.get(Logger));
  configureApp(app);
  app.enableShutdownHooks();

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  await app.listen(config.get('PORT', { infer: true }));
}

bootstrap().catch((error: unknown) => {
  // The logger may not exist yet (config error), so write straight to stderr
  console.error(
    'Failed to start the application:',
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
