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
import { PG_POOL } from '../../../src/core/db/db.tokens.js';
import {
  CLEARED_COOKIE,
  PASSWORD,
  createAuthClient,
  newEmail,
  parseRefreshCookie,
  setCookieHeaders,
  sha256,
} from '../../support/auth-api.js';
import { createTestApp } from '../../support/test-app.js';
import { resetUserData } from '../../support/test-db.js';

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

  const { register, login, refresh, logout, tokenRows } = createAuthClient(
    () => app,
    () => pool,
  );

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
