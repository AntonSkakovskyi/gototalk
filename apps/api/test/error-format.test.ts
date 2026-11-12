import {
  Body,
  Controller,
  Get,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ErrorResponseSchema } from '@gototalk/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createTestApp } from './support/test-app.js';

// Test-only controller: production code has no routes that throw these errors.
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

describe('error format and Swagger', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp({ controllers: [TestErrorsController] });
  });

  afterAll(async () => {
    await app.close();
  });

  it('[TC-00-07] unknown route: 404 NOT_FOUND in the error format', async () => {
    const res = await request(app.getHttpServer()).get('/api/nope');

    expect(res.status).toBe(404);
    const body = ErrorResponseSchema.parse(res.body);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: expect.any(String) },
    });
  });

  it('[TC-00-07] invalid body: 400 VALIDATION_ERROR listing fields without values', async () => {
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

  it('[TC-00-07] valid body passes without error', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/test-errors/validate')
      .send({ title: 'x', count: 1 });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });
  });

  it('[TC-00-07] malformed JSON: 400 in the error format without parser details', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/test-errors/validate')
      .set('Content-Type', 'application/json')
      .send('{"title": ');

    expect(res.status).toBe(400);
    const { error } = ErrorResponseSchema.parse(res.body);
    expect(error.code).toBe('BAD_REQUEST');
  });

  it('[TC-00-07] unexpected error: 500 INTERNAL_ERROR without details', async () => {
    const res = await request(app.getHttpServer()).get('/api/test-errors/boom');

    expect(res.status).toBe(500);
    const { error } = ErrorResponseSchema.parse(res.body);
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
  });

  it('[TC-00-07] 5xx HttpException: code derived from status without details', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/test-errors/unavailable',
    );

    expect(res.status).toBe(503);
    const { error } = ErrorResponseSchema.parse(res.body);
    expect(error.code).toBe('SERVICE_UNAVAILABLE');
    expect(JSON.stringify(res.body)).not.toContain('10.0.0.5');
  });

  it('Swagger UI is served at /api/docs and the JSON spec at /api/docs-json', async () => {
    const ui = await request(app.getHttpServer()).get('/api/docs');
    expect(ui.status).toBe(200);
    expect(ui.headers['content-type']).toContain('text/html');

    const json = await request(app.getHttpServer()).get('/api/docs-json');
    expect(json.status).toBe(200);
    expect(json.body).toMatchObject({ info: { title: 'GoToTalk API' } });
  });
});
