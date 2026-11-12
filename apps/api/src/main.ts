import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  // Повноцінний конфіг із валідацією Zod з'явиться в задачі 00-07
  const port = Number(process.env['PORT'] ?? 3000);
  await app.listen(port);
}

void bootstrap();
