import type { INestApplication } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AllExceptionsFilter } from './errors/all-exceptions.filter.js';

export const GLOBAL_PREFIX = 'api';

/**
 * Спільне налаштування застосунку для main.ts та інтеграційних тестів:
 * глобальний префікс, фільтр помилок, Swagger (фактичний URL `/api/docs`).
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.useGlobalFilters(
    new AllExceptionsFilter(app.get(HttpAdapterHost), app.get(Logger)),
  );

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('GoToTalk API')
      .setDescription('API тренера говоріння англійською')
      .setVersion('0.0.0')
      .build(),
  );
  SwaggerModule.setup('docs', app, document, { useGlobalPrefix: true });
}
