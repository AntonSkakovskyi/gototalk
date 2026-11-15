import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './support/test-app.js';

const OPERATIONS = [
  'DELETE /api/goals/{id}',
  'DELETE /api/me',
  'GET /api/goals',
  'GET /api/health',
  'GET /api/me',
  'GET /api/me/consent',
  'GET /api/profile',
  'GET /api/profile/learner-model',
  'GET /api/sessions',
  'GET /api/sessions/history',
  'GET /api/sessions/{id}',
  'GET /api/sessions/{id}/report',
  'GET /api/words',
  'PATCH /api/goals/{id}',
  'PATCH /api/sessions/{id}/mistakes/{mistakeId}',
  'PATCH /api/words/{id}',
  'POST /api/auth/login',
  'POST /api/auth/logout',
  'POST /api/auth/refresh',
  'POST /api/auth/register',
  'POST /api/goals',
  'POST /api/me/consent',
  'POST /api/sessions',
  'POST /api/sessions/plan',
  'POST /api/sessions/{id}/finish',
  'POST /api/sessions/{id}/hints',
  'POST /api/sessions/{id}/utterances',
  'POST /api/sessions/{id}/utterances/{utteranceId}/analysis',
  'PUT /api/profile',
];

const OPERATIONS_WITH_BODY = [
  'DELETE /api/me',
  'PATCH /api/goals/{id}',
  'PATCH /api/sessions/{id}/mistakes/{mistakeId}',
  'PATCH /api/words/{id}',
  'POST /api/auth/login',
  'POST /api/auth/register',
  'POST /api/goals',
  'POST /api/sessions',
  'POST /api/sessions/plan',
  'POST /api/sessions/{id}/hints',
  'POST /api/sessions/{id}/utterances',
  'PUT /api/profile',
];

const OPERATIONS_WITH_QUERY: Record<string, string[]> = {
  'GET /api/sessions/history': ['cursor', 'limit'],
  'GET /api/words': ['cursor', 'limit'],
};

interface OpenApiOperation {
  requestBody?: { content?: Record<string, { schema?: object }> };
  parameters?: { name: string; in: string; schema?: object }[];
}

type OpenApiPaths = Record<string, Record<string, OpenApiOperation>>;

describe('GET /api/docs-json', () => {
  let app: INestApplication;
  const operations = new Map<string, OpenApiOperation>();

  beforeAll(async () => {
    app = await createTestApp();
    const res = await request(app.getHttpServer()).get('/api/docs-json');
    const paths = (res.body as { paths: OpenApiPaths }).paths;
    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        operations.set(`${method.toUpperCase()} ${path}`, operation);
      }
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists exactly the known methods and paths', () => {
    expect([...operations.keys()].sort()).toEqual(OPERATIONS);
  });

  it('describes the request body of every operation that takes one', () => {
    for (const key of OPERATIONS_WITH_BODY) {
      const content = operations.get(key)?.requestBody?.content ?? {};
      const schemas = Object.values(content).map((media) => media.schema);

      expect(schemas, key).not.toHaveLength(0);
      expect(schemas.every(Boolean), key).toBe(true);
    }
  });

  it('describes the query parameters of every operation that takes them', () => {
    for (const [key, names] of Object.entries(OPERATIONS_WITH_QUERY)) {
      const query = (operations.get(key)?.parameters ?? []).filter(
        (parameter) => parameter.in === 'query',
      );

      expect(query.map((parameter) => parameter.name).sort(), key).toEqual(
        names,
      );
      expect(
        query.every((parameter) => parameter.schema),
        key,
      ).toBe(true);
    }
  });

  it('documents no request body for operations that take none', () => {
    const withoutBody = OPERATIONS.filter(
      (key) => !OPERATIONS_WITH_BODY.includes(key),
    );

    for (const key of withoutBody) {
      expect(operations.get(key)?.requestBody, key).toBeUndefined();
    }
  });
});
