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

  it('[TC-00-02] returns 200 { status: ok, db: ok } when the DB is available', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');

    expect(res.status).toBe(200);
    expect(HealthResponseSchema.parse(res.body)).toEqual({
      status: 'ok',
      db: 'ok',
    });
  });

  it('[TC-00-02] the endpoint is described in the Swagger document', async () => {
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

describe('GET /api/health, DB unavailable', () => {
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

  it('[TC-00-07] returns 503 in the error format without connection details', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');

    expect(res.status).toBe(503);
    const body = ErrorResponseSchema.parse(res.body);
    expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
    expect(JSON.stringify(res.body)).not.toContain('10.0.0.5');
  });
});

describe('GET /api/health, DB not responding', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register({ env: buildEnv() })],
    })
      .overrideProvider(DRIZZLE)
      .useValue({
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

  it('[TC-00-07] returns 503 on timeout instead of hanging', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');

    expect(res.status).toBe(503);
    expect(ErrorResponseSchema.parse(res.body).error.code).toBe(
      'SERVICE_UNAVAILABLE',
    );
  }, 10_000);
});
