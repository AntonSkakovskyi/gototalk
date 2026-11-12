import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ErrorResponseSchema, HealthResponseSchema } from '@gototalk/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { DRIZZLE } from '../src/db/db.tokens.js';

function buildEnv(): Record<string, string> {
  return {
    NODE_ENV: 'production',
    DATABASE_URL: inject('testDatabaseUrl'),
    PORT: '3456',
    LOG_LEVEL: 'silent',
  };
}

describe('GET /api/health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register({ env: buildEnv() })],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('[TC-00-02] повертає 200 { status: ok, db: ok } за доступної БД', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');

    expect(res.status).toBe(200);
    expect(HealthResponseSchema.parse(res.body)).toEqual({
      status: 'ok',
      db: 'ok',
    });
  });

  it('[TC-00-02] опис ендпоінта є у Swagger-документі', async () => {
    const res = await request(app.getHttpServer()).get('/api/docs-json');

    expect(res.status).toBe(200);
    const operation = (
      res.body as {
        paths: Record<string, Record<string, { responses: object }>>;
      }
    ).paths['/api/health']?.get;
    expect(operation).toBeDefined();
    expect(Object.keys(operation?.responses ?? {})).toEqual(
      expect.arrayContaining(['200', '503']),
    );
  });
});

describe('GET /api/health, БД недоступна', () => {
  const secret = 'ECONNREFUSED 10.0.0.5:5432 password=hunter2';
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register({ env: buildEnv() })],
    })
      .overrideProvider(DRIZZLE)
      .useValue({
        execute: () => Promise.reject(new Error(secret)),
      })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('[TC-00-07] повертає 503 у форматі помилки без деталей з’єднання', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');

    expect(res.status).toBe(503);
    const body = ErrorResponseSchema.parse(res.body);
    expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
    expect(JSON.stringify(res.body)).not.toContain('10.0.0.5');
  });
});

describe('GET /api/health, БД не відповідає', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register({ env: buildEnv() })],
    })
      .overrideProvider(DRIZZLE)
      .useValue({
        // Запит ніколи не завершується
        execute: () => new Promise(() => undefined),
      })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('[TC-00-07] повертає 503 за timeout, а не висить', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');

    expect(res.status).toBe(503);
    expect(ErrorResponseSchema.parse(res.body).error.code).toBe(
      'SERVICE_UNAVAILABLE',
    );
  }, 10_000);
});
