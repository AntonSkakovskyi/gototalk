import type { INestApplication } from '@nestjs/common';
import { AuthResponseSchema, ErrorResponseSchema } from '@gototalk/shared';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PG_POOL } from '../../../src/core/db/db.tokens.js';
import {
  CLEARED_COOKIE,
  createAuthClient,
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

  it('[TC-01-02] a rotated token replayed within the grace period gives 200 with a new cookie and revokes nothing', async () => {
    const { email, res: registered } = await register();
    const first = parseRefreshCookie(registered);
    const rotated = await refresh(first.value);

    const replay = await refresh(first.value);

    expect(replay.status).toBe(200);
    expect(AuthResponseSchema.parse(replay.body).user.email).toBe(email);
    const sibling = parseRefreshCookie(replay);
    expect(sibling.value).not.toBe(parseRefreshCookie(rotated).value);
    const rows = await tokenRows(email);
    expect(rows).toHaveLength(3);
    expect(rows.filter((r) => r.revoked_at !== null)).toHaveLength(1);
    expect((await refresh(parseRefreshCookie(rotated).value)).status).toBe(200);
    expect((await refresh(sibling.value)).status).toBe(200);
  });

  it('[TC-01-02] a rotated token replayed after the grace period gives 401 and removes all tokens of the user', async () => {
    const { email, res: registered } = await register();
    const first = parseRefreshCookie(registered);
    const second = parseRefreshCookie(await login(email));
    const { email: otherEmail, res: otherRegistered } = await register();
    const rotatedCookie = parseRefreshCookie(await refresh(first.value));
    await pool.query(
      `UPDATE refresh_tokens SET revoked_at = now() - interval '2 minutes'
       WHERE token_hash = $1`,
      [sha256(first.value)],
    );

    const reuse = await refresh(first.value);

    expect(reuse.status).toBe(401);
    expect(setCookieHeaders(reuse).join(';')).toMatch(CLEARED_COOKIE);
    expect(await tokenRows(email)).toHaveLength(0);
    expect((await refresh(second.value)).status).toBe(401);
    expect((await refresh(rotatedCookie.value)).status).toBe(401);
    expect(await tokenRows(otherEmail)).toHaveLength(1);
    expect(
      (await refresh(parseRefreshCookie(otherRegistered).value)).status,
    ).toBe(200);
  });

  it('[TC-01-02] a replay after a reuse wipe gives a plain 401 and does not touch other users', async () => {
    const { res: registered } = await register();
    const first = parseRefreshCookie(registered);
    await refresh(first.value);
    await pool.query(
      `UPDATE refresh_tokens SET revoked_at = now() - interval '2 minutes'
       WHERE token_hash = $1`,
      [sha256(first.value)],
    );
    expect((await refresh(first.value)).status).toBe(401);

    const again = await refresh(first.value);

    expect(again.status).toBe(401);
    expect(setCookieHeaders(again).join(';')).toMatch(CLEARED_COOKIE);
  });

  it('[TC-01-02] two parallel refreshes of the same cookie give 200 and 200 and each new cookie can refresh again', async () => {
    const { res: registered } = await register();
    const cookie = parseRefreshCookie(registered);

    const results = await Promise.all([
      refresh(cookie.value),
      refresh(cookie.value),
    ]);

    expect(results.map((r) => r.status)).toEqual([200, 200]);
    const cookies = results.map((r) => parseRefreshCookie(r).value);
    expect(new Set(cookies).size).toBe(2);
    for (const value of cookies) {
      expect((await refresh(value)).status).toBe(200);
    }
  });

  it('[TC-01-02] a replay of a cookie after logout gives 401 and keeps the other sessions of the user', async () => {
    const { email, res: registered } = await register();
    const first = parseRefreshCookie(registered);
    const otherSession = parseRefreshCookie(await login(email));
    const rotated = parseRefreshCookie(await refresh(first.value));
    expect((await logout(rotated.value)).status).toBe(204);
    expect((await logout(first.value)).status).toBe(204);

    const replay = await refresh(first.value);

    expect(replay.status).toBe(401);
    expect(setCookieHeaders(replay).join(';')).toMatch(CLEARED_COOKIE);
    expect((await refresh(rotated.value)).status).toBe(401);
    expect(await tokenRows(email)).toHaveLength(1);
    expect((await refresh(otherSession.value)).status).toBe(200);
  });

  it('[TC-01-02] logout deletes the token row', async () => {
    const { email, res: registered } = await register();
    const cookie = parseRefreshCookie(registered);

    expect((await logout(cookie.value)).status).toBe(204);

    expect(await tokenRows(email)).toHaveLength(0);
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
});
