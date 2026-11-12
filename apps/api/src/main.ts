import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import type { Env } from './config/env.schema.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule.register(), {
    bufferLogs: true,
    // Помилку запуску (напр. невалідний env) обробляє catch нижче, а не вбудований ExceptionHandler
    abortOnError: false,
  });
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api');

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  await app.listen(config.get('PORT', { infer: true }));
}

bootstrap().catch((error: unknown) => {
  // Логер міг ще не піднятися (помилка конфігу), тому пишемо напряму в stderr
  console.error(
    'Не вдалося запустити застосунок:',
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
