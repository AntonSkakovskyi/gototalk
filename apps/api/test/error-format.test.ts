import 'reflect-metadata';
import {
  Body,
  Controller,
  Get,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ErrorResponseSchema } from '@gototalk/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';

// Контролер існує лише в тесті: у production-коді немає маршрутів, що викидають ці помилки
const BodySchema = z.object({
  title: z.string().min(1),
  count: z.number().int(),
});

@Controller('test-errors')
class TestErrorsController {
  @Post('validate')
  validate(@Body() body: unknown): { ok: true } {
    BodySchema.parse(body);
    return { ok: true };
  }

  @Get('boom')
  boom(): never {
    throw new Error('db password=hunter2 at 10.0.0.5');
  }

  @Get('unavailable')
  unavailable(): never {
    throw new ServiceUnavailableException('pool exhausted 10.0.0.5');
  }
}

// Тести передають env явно, БД на цьому етапі не потрібна
const env = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/gototalk_test',
  PORT: '3456',
  LOG_LEVEL: 'silent',
};

describe('формат помилок і Swagger', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register({ env })],
      controllers: [TestErrorsController],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('[TC-00-07] неіснуючий маршрут: 404 NOT_FOUND у форматі помилки', async () => {
    const res = await request(app.getHttpServer()).get('/api/nope');

    expect(res.status).toBe(404);
    const body = ErrorResponseSchema.parse(res.body);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: expect.any(String) },
    });
  });

  it('[TC-00-07] невалідне тіло: 400 VALIDATION_ERROR з переліком полів без значень', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/test-errors/validate')
      .send({ title: '', count: 'leaky-value' });

    expect(res.status).toBe(400);
    const { error } = ErrorResponseSchema.parse(res.body);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toContain('title');
    expect(error.message).toContain('count');
    expect(error.message).not.toContain('leaky-value');
  });

  it('[TC-00-07] валідне тіло проходить без помилки', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/test-errors/validate')
      .send({ title: 'x', count: 1 });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });
  });

  it('[TC-00-07] зламаний JSON: 400 у форматі помилки без деталей парсера', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/test-errors/validate')
      .set('Content-Type', 'application/json')
      .send('{"title": ');

    expect(res.status).toBe(400);
    const { error } = ErrorResponseSchema.parse(res.body);
    expect(error.code).toBe('BAD_REQUEST');
  });

  it('[TC-00-07] неочікувана помилка: 500 INTERNAL_ERROR без деталей', async () => {
    const res = await request(app.getHttpServer()).get('/api/test-errors/boom');

    expect(res.status).toBe(500);
    const { error } = ErrorResponseSchema.parse(res.body);
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
  });

  it('[TC-00-07] 5xx HttpException: код зі статусу без деталей', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/test-errors/unavailable',
    );

    expect(res.status).toBe(503);
    const { error } = ErrorResponseSchema.parse(res.body);
    expect(error.code).toBe('SERVICE_UNAVAILABLE');
    expect(JSON.stringify(res.body)).not.toContain('10.0.0.5');
  });

  it('Swagger UI відкривається на /api/docs, а JSON-опис на /api/docs-json', async () => {
    const ui = await request(app.getHttpServer()).get('/api/docs');
    expect(ui.status).toBe(200);
    expect(ui.headers['content-type']).toContain('text/html');

    const json = await request(app.getHttpServer()).get('/api/docs-json');
    expect(json.status).toBe(200);
    expect(json.body).toMatchObject({ info: { title: 'GoToTalk API' } });
  });
});
