import { createHash, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { AuthResponseSchema, ErrorResponseSchema } from '@gototalk/shared';
import { Logger } from 'nestjs-pino';
import pg from 'pg';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { PG_POOL } from '../src/db/db.tokens.js';
import { createTestApp } from './support/test-app.js';
import { resetUserData } from './support/test-db.js';

const COOKIE_NAME = 'gtt_refresh';
const PASSWORD = 'correct-horse-battery';

interface ParsedCookie {
  value: string;
  attributes: string[];
}

function setCookieHeaders(res: request.Response): string[] {
  const header = res.headers['set-cookie'] as string[] | string | undefined;
  return Array.isArray(header) ? header : header ? [header] : [];
}

function parseRefreshCookie(res: request.Response): ParsedCookie {
  const raw = setCookieHeaders(res).find((c) =>
    c.startsWith(`${COOKIE_NAME}=`),
  );
  if (!raw) throw new Error('No refresh cookie in the response');
  const [pair = '', ...attributes] = raw.split('; ');
  return { value: pair.slice(COOKIE_NAME.length + 1), attributes };
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

const CLEARED_COOKIE = new RegExp(`${COOKIE_NAME}=;.*Path=/api/auth`);

describe('Auth endpoints', () => {
  let app: INestApplication;
  let pool: pg.Pool;

  beforeAll(async () => {
    app = await createTestApp();
    pool = app.get<pg.Pool>(PG_POOL);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetUserData(pool);
  });

  const newEmail = () => `${randomUUID()}@example.com`;

  async function register(email = newEmail(), password = PASSWORD) {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password });
    return { email, res };
  }

  function login(email: string, password = PASSWORD) {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password });
  }

  function post(path: string, cookieValue?: string) {
    const req = request(app.getHttpServer()).post(path);
    return cookieValue === undefined
      ? req
      : req.set('Cookie', `${COOKIE_NAME}=${cookieValue}`);
  }

  const refresh = (cookieValue?: string) =>
    post('/api/auth/refresh', cookieValue);
  const logout = (cookieValue?: string) =>
    post('/api/auth/logout', cookieValue);

  async function tokenRows(email: string) {
    const { rows } = await pool.query<{
      token_hash: string;
      revoked_at: Date | null;
    }>(
      `SELECT rt.token_hash, rt.revoked_at FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id WHERE u.email = $1`,
      [email],
    );
    return rows;
  }

  it('[TC-01-02] register -> login -> refresh -> logout', async () => {
    const { email, res: registered } = await register();
    expect(registered.status).toBe(201);
    const registeredBody = AuthResponseSchema.parse(registered.body);
    expect(registeredBody.user.email).toBe(email);
    expect(registeredBody.user.consentAt).toBeNull();

    const loggedIn = await login(email);
    expect(loggedIn.status).toBe(200);
    AuthResponseSchema.parse(loggedIn.body);
    const loginCookie = parseRefreshCookie(loggedIn);

    const refreshed = await refresh(loginCookie.value);
    expect(refreshed.status).toBe(200);
    const refreshedBody = AuthResponseSchema.parse(refreshed.body);
    expect(refreshedBody.user.id).toBe(registeredBody.user.id);
    const newCookie = parseRefreshCookie(refreshed);
    expect(newCookie.value).not.toBe(loginCookie.value);

    const oldRow = (await tokenRows(email)).find(
      (r) => r.token_hash === sha256(loginCookie.value),
    );
    expect(oldRow?.revoked_at).not.toBeNull();

    const loggedOut = await logout(newCookie.value);
    expect(loggedOut.status).toBe(204);
    expect(setCookieHeaders(loggedOut).join(';')).toMatch(CLEARED_COOKIE);

    const afterLogout = await refresh(newCookie.value);
    expect(afterLogout.status).toBe(401);
  });

  it('[TC-01-02] the access token is a 15 minute JWT for the user id', async () => {
    const { res: registered } = await register();
    const cookie = parseRefreshCookie(registered);

    const refreshed = AuthResponseSchema.parse(
      (await refresh(cookie.value)).body,
    );

    const payload = JSON.parse(
      Buffer.from(
        refreshed.accessToken.split('.')[1] ?? '',
        'base64url',
      ).toString(),
    ) as { sub: string; exp: number; iat: number };
    expect(payload.sub).toBe(refreshed.user.id);
    expect(payload.exp - payload.iat).toBe(15 * 60);
  });

  it('[TC-01-02] a revoked refresh token presented again gives 401 and revokes all tokens of the user', async () => {
    const { email, res: registered } = await register();
    const first = parseRefreshCookie(registered);
    const second = parseRefreshCookie(await login(email));
    const rotatedCookie = parseRefreshCookie(await refresh(first.value));

    const reuse = await refresh(first.value);

    expect(reuse.status).toBe(401);
    expect(setCookieHeaders(reuse).join(';')).toMatch(CLEARED_COOKIE);
    const rows = await tokenRows(email);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.revoked_at !== null)).toBe(true);
    expect((await refresh(second.value)).status).toBe(401);
    expect((await refresh(rotatedCookie.value)).status).toBe(401);
  });

  it('[TC-01-02] two parallel refreshes of the same cookie give exactly one 200', async () => {
    const { res: registered } = await register();
    const cookie = parseRefreshCookie(registered);

    const results = await Promise.all([
      refresh(cookie.value),
      refresh(cookie.value),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
  });

  it('[TC-01-02] after two parallel refreshes the winner new cookie is revoked too', async () => {
    const { res: registered } = await register();
    const cookie = parseRefreshCookie(registered);

    const results = await Promise.all([
      refresh(cookie.value),
      refresh(cookie.value),
    ]);

    const winner = results.find((r) => r.status === 200);
    if (!winner) throw new Error('No refresh succeeded');
    const afterRace = await refresh(parseRefreshCookie(winner).value);
    expect(afterRace.status).toBe(401);
  });

  it('[TC-01-02] a rotated token reused twice gives 401 both times', async () => {
    const { res: registered } = await register();
    const cookie = parseRefreshCookie(registered);
    expect((await refresh(cookie.value)).status).toBe(200);

    expect((await refresh(cookie.value)).status).toBe(401);
    expect((await refresh(cookie.value)).status).toBe(401);
  });

  it('[TC-01-02] register and login without a password give 400 and no cookie', async () => {
    const email = newEmail();
    const server = app.getHttpServer();

    const registered = await request(server)
      .post('/api/auth/register')
      .send({ email });
    const loggedIn = await request(server)
      .post('/api/auth/login')
      .send({ email });

    for (const res of [registered, loggedIn]) {
      expect(res.status).toBe(400);
      expect(ErrorResponseSchema.parse(res.body).error.code).toBe(
        'VALIDATION_ERROR',
      );
      expect(setCookieHeaders(res)).toEqual([]);
    }
  });

  it('[TC-01-02] a failing query during register is logged without the email or the password hash', async () => {
    const email = newEmail();
    const logged: unknown[] = [];
    const logSpy = vi
      .spyOn(app.get(Logger), 'error')
      .mockImplementation((...args: unknown[]) => {
        logged.push(args);
      });
    const querySpy = vi
      .spyOn(pool, 'query')
      .mockRejectedValueOnce(new Error('connection terminated'));

    const res = await register(email);

    querySpy.mockRestore();
    logSpy.mockRestore();
    expect(res.res.status).toBe(500);
    expect(logged).toHaveLength(1);
    const dumped = JSON.stringify(logged, (_key, value: unknown) =>
      value instanceof Error
        ? Object.fromEntries(
            Object.getOwnPropertyNames(value).map((name) => [
              name,
              (value as unknown as Record<string, unknown>)[name],
            ]),
          )
        : value,
    );
    expect(dumped).toContain('connection terminated');
    expect(dumped).not.toContain(email);
    expect(dumped).not.toContain('argon2id');
    expect(dumped).not.toContain(PASSWORD);
  });

  it('[TC-01-02] refresh without a cookie, or with an unknown one, gives 401 and clears the cookie', async () => {
    for (const res of [await refresh(), await refresh('not-a-real-token')]) {
      expect(res.status).toBe(401);
      expect(ErrorResponseSchema.parse(res.body).error.code).toBe(
        'UNAUTHORIZED',
      );
      expect(setCookieHeaders(res).join(';')).toMatch(CLEARED_COOKIE);
    }
  });

  it('[TC-01-02] logout is idempotent and works without a valid cookie', async () => {
    const { res: registered } = await register();
    const cookie = parseRefreshCookie(registered);

    expect((await logout(cookie.value)).status).toBe(204);
    expect((await logout(cookie.value)).status).toBe(204);
    expect((await logout()).status).toBe(204);
    expect((await logout('garbage')).status).toBe(204);
  });

  it('[TC-01-02] the refresh cookie is HttpOnly, Secure, SameSite=Strict, scoped to /api/auth for 30 days', async () => {
    const { res } = await register();

    const cookie = parseRefreshCookie(res);

    expect(cookie.attributes).toEqual(
      expect.arrayContaining([
        'HttpOnly',
        'Secure',
        'SameSite=Strict',
        'Path=/api/auth',
        `Max-Age=${30 * 24 * 60 * 60}`,
      ]),
    );
    expect(cookie.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('[TC-01-02] the database stores the sha-256 of the refresh token, not the token', async () => {
    const { email, res } = await register();
    const cookie = parseRefreshCookie(res);

    const rows = await tokenRows(email);

    expect(rows.map((r) => r.token_hash)).toEqual([sha256(cookie.value)]);
  });

  it('[TC-01-02] the password is stored as an argon2id hash', async () => {
    const { email } = await register();

    const { rows } = await pool.query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE email = $1',
      [email],
    );

    expect(rows[0]?.password_hash).toMatch(/^\$argon2id\$/);
    expect(rows[0]?.password_hash).not.toContain(PASSWORD);
  });

  it('[TC-01-02] a duplicate email gives 409 EMAIL_TAKEN, also for a case variant', async () => {
    const { email } = await register();

    const duplicate = await register(email.toUpperCase());

    expect(duplicate.res.status).toBe(409);
    expect(ErrorResponseSchema.parse(duplicate.res.body).error.code).toBe(
      'EMAIL_TAKEN',
    );
  });

  it('[TC-01-02] concurrent registrations of one email give one 201 and one 409', async () => {
    const email = newEmail();

    const results = await Promise.all([register(email), register(email)]);

    expect(results.map((r) => r.res.status).sort()).toEqual([201, 409]);
  });

  it('[TC-01-02] a short password gives 400 VALIDATION_ERROR without echoing the password', async () => {
    const { res } = await register(newEmail(), 'short');

    expect(res.status).toBe(400);
    expect(ErrorResponseSchema.parse(res.body).error.code).toBe(
      'VALIDATION_ERROR',
    );
    expect(JSON.stringify(res.body)).not.toContain('short');
  });

  it('[TC-01-02] an invalid email gives 400 VALIDATION_ERROR', async () => {
    const { res } = await register('not-an-email');

    expect(res.status).toBe(400);
    expect(ErrorResponseSchema.parse(res.body).error.code).toBe(
      'VALIDATION_ERROR',
    );
  });

  it('[TC-01-02] email case and whitespace variants map to the same user', async () => {
    const email = newEmail();
    const { res: registered } = await register(`  ${email.toUpperCase()}  `);
    expect(registered.status).toBe(201);
    expect(AuthResponseSchema.parse(registered.body).user.email).toBe(email);

    const loggedIn = await login(` ${email} `);

    expect(loggedIn.status).toBe(200);
    expect(AuthResponseSchema.parse(loggedIn.body).user.id).toBe(
      AuthResponseSchema.parse(registered.body).user.id,
    );
  });

  it('[TC-01-02] consentAt is an ISO string with Z once the user has consented', async () => {
    const { email } = await register();
    await pool.query(
      `UPDATE users SET consent_at = '2026-11-13 10:00:00.5+00' WHERE email = $1`,
      [email],
    );

    const res = await login(email);

    expect(AuthResponseSchema.parse(res.body).user.consentAt).toBe(
      '2026-11-13T10:00:00.500Z',
    );
  });

  it('[TC-01-05] an unknown email and a wrong password give the same status and body', async () => {
    const { email } = await register();

    const wrongPassword = await login(email, 'definitely-wrong');
    const unknownEmail = await login(newEmail(), 'definitely-wrong');

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(wrongPassword.status);
    expect(unknownEmail.body).toEqual(wrongPassword.body);
    expect(ErrorResponseSchema.parse(wrongPassword.body).error.code).toBe(
      'INVALID_CREDENTIALS',
    );
    expect(setCookieHeaders(wrongPassword)).toEqual([]);
  });
});
