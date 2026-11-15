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

const RESPONSES_WITH_SCHEMA: Record<string, string> = {
  'GET /api/health': '200',
  'GET /api/me': '200',
  'GET /api/me/consent': '200',
  'POST /api/me/consent': '200',
  'POST /api/auth/register': '201',
  'POST /api/auth/login': '200',
  'POST /api/auth/refresh': '200',
  'GET /api/profile': '200',
  'PUT /api/profile': '200',
  'GET /api/profile/learner-model': '200',
  'GET /api/goals': '200',
  'POST /api/goals': '201',
  'PATCH /api/goals/{id}': '200',
  'POST /api/sessions/plan': '200',
  'POST /api/sessions': '201',
  'GET /api/sessions': '200',
  'GET /api/sessions/history': '200',
  'GET /api/sessions/{id}': '200',
  'POST /api/sessions/{id}/finish': '200',
  'GET /api/sessions/{id}/report': '200',
  'POST /api/sessions/{id}/utterances': '201',
  'POST /api/sessions/{id}/utterances/{utteranceId}/analysis': '200',
  'POST /api/sessions/{id}/hints': '200',
  'PATCH /api/sessions/{id}/mistakes/{mistakeId}': '200',
  'GET /api/words': '200',
  'PATCH /api/words/{id}': '200',
};

const RESPONSE_PROPERTIES: Record<string, string> = {
  'GET /api/health': 'status',
  'POST /api/auth/login': 'accessToken',
  'POST /api/sessions/plan': 'questions',
  'GET /api/sessions/history': 'nextCursor',
  'POST /api/sessions/{id}/utterances/{utteranceId}/analysis': 'planRemaining',
  'GET /api/words': 'items',
};

interface OpenApiSchema {
  type?: string;
  properties?: Record<string, unknown>;
  minimum?: number;
  maximum?: number;
  required?: string[];
  oneOf?: { properties?: Record<string, { enum?: string[] }> }[];
}

interface OpenApiOperation {
  requestBody?: { content?: Record<string, { schema?: OpenApiSchema }> };
  responses?: Record<
    string,
    { content?: Record<string, { schema?: OpenApiSchema }> }
  >;
  parameters?: { name: string; in: string; schema?: OpenApiSchema }[];
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

  it('documents the bounds of the paginated limit query parameter', () => {
    for (const key of Object.keys(OPERATIONS_WITH_QUERY)) {
      const limit = operations
        .get(key)
        ?.parameters?.find((parameter) => parameter.name === 'limit');

      expect(limit?.schema, key).toMatchObject({
        type: 'integer',
        minimum: 1,
        maximum: 50,
      });
    }
  });

  it('documents the required fields of the request bodies', () => {
    const requiredOf = (key: string): string[] | undefined =>
      operations.get(key)?.requestBody?.content?.['application/json']?.schema
        ?.required;

    expect(requiredOf('POST /api/auth/register')).toEqual([
      'email',
      'password',
    ]);
    expect(requiredOf('POST /api/sessions')).toEqual([
      'topic',
      'topicSource',
      'questions',
    ]);
  });

  it('documents the hint request body as one schema per hint kind', () => {
    const variants =
      operations.get('POST /api/sessions/{id}/hints')?.requestBody?.content?.[
        'application/json'
      ]?.schema?.oneOf ?? [];

    expect(variants.map((variant) => variant.properties?.kind?.enum)).toEqual([
      ['phrase_start'],
      ['translation'],
    ]);
  });

  it('documents the success response of every operation with a shared schema', () => {
    for (const [key, status] of Object.entries(RESPONSES_WITH_SCHEMA)) {
      const schema =
        operations.get(key)?.responses?.[status]?.content?.['application/json']
          ?.schema;

      expect(schema, key).toBeDefined();
      expect(schema, key).not.toEqual({});
      expect(Object.keys(schema ?? {}), key).not.toHaveLength(0);
    }
  });

  it('documents the shape of representative responses', () => {
    for (const [key, property] of Object.entries(RESPONSE_PROPERTIES)) {
      const schema =
        operations.get(key)?.responses?.[RESPONSES_WITH_SCHEMA[key] ?? '']
          ?.content?.['application/json']?.schema;

      expect(schema?.type, key).toBe('object');
      expect(Object.keys(schema?.properties ?? {}), key).toContain(property);
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
