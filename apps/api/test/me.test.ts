import { randomUUID } from 'node:crypto';
import { Controller, Get } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  AuthResponseSchema,
  ConsentInfoSchema,
  ErrorResponseSchema,
  MeSchema,
} from '@gototalk/shared';
import type pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { RequiresConsent } from '../src/auth/requires-consent.decorator.js';
import { PG_POOL } from '../src/db/db.tokens.js';
import { createTestApp } from './support/test-app.js';
import { resetUserData } from './support/test-db.js';

const PASSWORD = 'correct-horse-battery';
const MISSING_USER_ID = '6f1c2a0e-4b8d-4f7e-9a53-0c7d2f1b9e11';

@Controller('test-consent')
class TestConsentController {
  @Get('required')
  @RequiresConsent()
  required(): { ok: true } {
    return { ok: true };
  }
}

interface OpenApiDocument {
  paths: Record<string, Record<string, unknown>>;
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
const OPEN_OPERATIONS = new Set([
  'POST /api/auth/register',
  'POST /api/auth/login',
  'POST /api/auth/refresh',
  'POST /api/auth/logout',
  'GET /api/health',
]);

describe('Me and consent endpoints', () => {
  let app: INestApplication;
  let pool: pg.Pool;

  beforeAll(async () => {
    app = await createTestApp({ controllers: [TestConsentController] });
    pool = app.get<pg.Pool>(PG_POOL);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetUserData(pool);
  });

  async function registerUser() {
    const email = `${randomUUID()}@example.com`;
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: PASSWORD });
    const { accessToken, user } = AuthResponseSchema.parse(res.body);
    return { email, token: accessToken, id: user.id };
  }

  const get = (path: string, token: string) =>
    request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${token}`);

  const grantConsent = (token: string) =>
    request(app.getHttpServer())
      .post('/api/me/consent')
      .set('Authorization', `Bearer ${token}`);

  const tokenOfMissingUser = () =>
    app.get(JwtService).signAsync({ sub: MISSING_USER_ID });

  it('[TC-01-02] a new user has consentAt null on GET /api/me', async () => {
    const { email, id, token } = await registerUser();

    const res = await get('/api/me', token);

    expect(res.status).toBe(200);
    expect(MeSchema.parse(res.body)).toEqual({ id, email, consentAt: null });
  });

  it('[TC-01-02] GET /api/me returns 401 UNAUTHORIZED when the user no longer exists', async () => {
    const res = await get('/api/me', await tokenOfMissingUser());

    expect(res.status).toBe(401);
    expect(ErrorResponseSchema.parse(res.body).error.code).toBe('UNAUTHORIZED');
  });

  it('[TC-01-02] POST /api/me/consent sets an ISO date and a second POST keeps it', async () => {
    const { token } = await registerUser();

    const first = await grantConsent(token);
    expect(first.status).toBe(200);
    const firstMe = MeSchema.parse(first.body);
    expect(firstMe.consentAt).toMatch(/Z$/);
    const age = Date.now() - new Date(firstMe.consentAt as string).getTime();
    expect(age).toBeLessThan(60_000);

    const second = await grantConsent(token);
    expect(second.status).toBe(200);
    expect(MeSchema.parse(second.body).consentAt).toBe(firstMe.consentAt);

    const reread = await get('/api/me', token);
    expect(MeSchema.parse(reread.body).consentAt).toBe(firstMe.consentAt);
  });

  it('[TC-01-02] POST /api/me/consent does not overwrite an existing consent_at', async () => {
    const { id, token } = await registerUser();
    await pool.query(
      "UPDATE users SET consent_at = '2020-01-02 03:04:05+00' WHERE id = $1",
      [id],
    );

    const res = await grantConsent(token);

    expect(res.status).toBe(200);
    expect(MeSchema.parse(res.body).consentAt).toBe('2020-01-02T03:04:05.000Z');
  });

  it('[TC-01-02] two parallel POST /api/me/consent both return 200 with the same consentAt', async () => {
    const { token } = await registerUser();

    const [a, b] = await Promise.all([
      grantConsent(token),
      grantConsent(token),
    ]);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const meA = MeSchema.parse(a.body);
    expect(meA.consentAt).not.toBeNull();
    expect(MeSchema.parse(b.body).consentAt).toBe(meA.consentAt);
  });

  it('[TC-01-04] a garbage Bearer token on a me route returns 401', async () => {
    const res = await get('/api/me', 'not-a-jwt');

    expect(res.status).toBe(401);
    expect(ErrorResponseSchema.parse(res.body).error.code).toBe('UNAUTHORIZED');
  });

  it('[TC-01-02] POST /api/me/consent returns 401 when the user no longer exists', async () => {
    const res = await grantConsent(await tokenOfMissingUser());

    expect(res.status).toBe(401);
  });

  it('[TC-01-02] GET /api/me/consent returns the providers and the consentAt', async () => {
    const { token } = await registerUser();

    const before = await get('/api/me/consent', token);
    expect(before.status).toBe(200);
    expect(ConsentInfoSchema.parse(before.body)).toEqual({
      consentAt: null,
      providers: { stt: 'fake', llm: 'fake' },
    });

    const granted = MeSchema.parse((await grantConsent(token)).body);
    const after = ConsentInfoSchema.parse(
      (await get('/api/me/consent', token)).body,
    );
    expect(after.consentAt).toBe(granted.consentAt);
    expect(after.providers).toEqual({ stt: 'fake', llm: 'fake' });
  });

  it('[TC-01-02] a route with RequiresConsent returns 403 CONSENT_REQUIRED before consent and 200 after', async () => {
    const { token } = await registerUser();

    const denied = await get('/api/test-consent/required', token);
    expect(denied.status).toBe(403);
    expect(ErrorResponseSchema.parse(denied.body).error.code).toBe(
      'CONSENT_REQUIRED',
    );

    await grantConsent(token);

    const allowed = await get('/api/test-consent/required', token);
    expect(allowed.status).toBe(200);
    expect(allowed.body).toEqual({ ok: true });
  });

  it('[TC-01-02] a route with RequiresConsent returns 401 without a token', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/test-consent/required',
    );

    expect(res.status).toBe(401);
  });

  it('[TC-01-02] a route with RequiresConsent returns 401 when the user no longer exists', async () => {
    const res = await get(
      '/api/test-consent/required',
      await tokenOfMissingUser(),
    );

    expect(res.status).toBe(401);
  });

  it('[TC-01-06] the token of user B returns the data of B, and consent of B does not touch A', async () => {
    const a = await registerUser();
    const b = await registerUser();

    await grantConsent(b.token);

    const meA = MeSchema.parse((await get('/api/me', a.token)).body);
    const meB = MeSchema.parse((await get('/api/me', b.token)).body);
    expect(meA).toEqual({ id: a.id, email: a.email, consentAt: null });
    expect(meB.id).toBe(b.id);
    expect(meB.email).toBe(b.email);
    expect(meB.consentAt).not.toBeNull();
  });

  it('[TC-01-04] every documented operation except the open ones returns 401 without a token', async () => {
    const docs = await request(app.getHttpServer()).get('/api/docs-json');
    expect(docs.status).toBe(200);
    const { paths } = docs.body as OpenApiDocument;

    const checked: string[] = [];
    for (const [path, item] of Object.entries(paths)) {
      for (const method of HTTP_METHODS) {
        if (!(method in item)) continue;
        const key = `${method.toUpperCase()} ${path}`;
        if (OPEN_OPERATIONS.has(key)) continue;

        const url = path.replace(/\{[^}]+\}/g, randomUUID());
        const req = request(app.getHttpServer())[method](url);
        const res = await (method === 'get' ? req : req.send({}));

        expect(res.status, key).toBe(401);
        checked.push(key);
      }
    }

    expect(checked).toEqual(
      expect.arrayContaining([
        'GET /api/me',
        'GET /api/me/consent',
        'POST /api/me/consent',
      ]),
    );
  });

  it('[TC-01-04] the open operations list matches the documented API', async () => {
    const docs = await request(app.getHttpServer()).get('/api/docs-json');
    const { paths } = docs.body as OpenApiDocument;

    for (const key of OPEN_OPERATIONS) {
      const [method = '', path = ''] = key.split(' ');
      expect(method.toLowerCase() in (paths[path] ?? {}), key).toBe(true);
    }
  });

  it('[TC-01-04] every me operation is documented with a bearer requirement', async () => {
    const docs = await request(app.getHttpServer()).get('/api/docs-json');
    const { paths } = docs.body as OpenApiDocument;

    for (const key of [
      'get /api/me',
      'get /api/me/consent',
      'post /api/me/consent',
    ]) {
      const [method = '', path = ''] = key.split(' ');
      const operation = (paths[path] ?? {})[method] as {
        security?: Record<string, unknown>[];
      };
      expect(operation.security, key).toEqual([{ bearer: [] }]);
    }
  });
});
