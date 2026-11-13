import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import {
  AuthResponseSchema,
  ErrorResponseSchema,
  MeSchema,
} from '@gototalk/shared';
import type pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PG_POOL } from '../src/core/db/db.tokens.js';
import { createTestApp } from './support/test-app.js';
import { resetUserData } from './support/test-db.js';
import {
  USER_DATA_TABLES,
  countReferenceData,
  countUserData,
  insertUserData,
} from './support/user-data.js';

const PASSWORD = 'correct-horse-battery';
const WRONG_PASSWORD = 'zebra-wrong-9317-passphrase';
const COOKIE_NAME = 'gtt_refresh';

interface TestUser {
  id: string;
  email: string;
  token: string;
  cookie: string;
}

describe('Account deletion and isolation', () => {
  let app: INestApplication;
  let pool: pg.Pool;
  let theoryLinkId: string;

  beforeAll(async () => {
    app = await createTestApp();
    pool = app.get<pg.Pool>(PG_POOL);
    theoryLinkId = randomUUID();
  });

  afterAll(async () => {
    await pool.query('DELETE FROM theory_links WHERE id = $1', [theoryLinkId]);
    await app.close();
  });

  beforeEach(async () => {
    await resetUserData(pool);
    await pool.query(
      `INSERT INTO theory_links (id, category, title, url)
       VALUES ($1, 'articles', 'delete-account probe', 'https://example.com')
       ON CONFLICT DO NOTHING`,
      [theoryLinkId],
    );
  });

  async function registerUser(): Promise<TestUser> {
    const email = `${randomUUID()}@example.com`;
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: PASSWORD });
    const { accessToken, user } = AuthResponseSchema.parse(res.body);
    const header = res.headers['set-cookie'] as unknown as string[];
    const raw = header.find((c) => c.startsWith(`${COOKIE_NAME}=`)) ?? '';
    const cookie = raw.split(';')[0] ?? '';
    await insertUserData(pool, user.id, { theoryLinkId });
    return { id: user.id, email, token: accessToken, cookie };
  }

  const deleteMe = (token: string, body?: object) => {
    const req = request(app.getHttpServer())
      .delete('/api/me')
      .set('Authorization', `Bearer ${token}`);
    return body === undefined ? req : req.send(body);
  };

  const getMe = (token: string) =>
    request(app.getHttpServer())
      .get('/api/me')
      .set('Authorization', `Bearer ${token}`);

  it('[TC-01-02] a wrong password returns 403 INVALID_PASSWORD and deletes nothing', async () => {
    const user = await registerUser();
    const before = await countUserData(pool, user.id);

    const res = await deleteMe(user.token, { password: WRONG_PASSWORD });

    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).not.toContain(WRONG_PASSWORD);
    expect(ErrorResponseSchema.parse(res.body).error.code).toBe(
      'INVALID_PASSWORD',
    );
    expect(await countUserData(pool, user.id)).toEqual(before);
    expect((await getMe(user.token)).status).toBe(200);
  });

  it('[TC-01-02] a wrong password does not clear the refresh cookie', async () => {
    const user = await registerUser();

    const res = await deleteMe(user.token, { password: WRONG_PASSWORD });

    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('[TC-01-02] the correct password returns 204 and removes the user rows from every table', async () => {
    const user = await registerUser();
    const other = await registerUser();
    const otherBefore = await countUserData(pool, other.id);
    for (const table of USER_DATA_TABLES) {
      expect(
        (await countUserData(pool, user.id))[table],
        table,
      ).toBeGreaterThan(0);
    }

    const res = await deleteMe(user.token, { password: PASSWORD });

    expect(res.status).toBe(204);
    const after = await countUserData(pool, user.id);
    for (const table of USER_DATA_TABLES) {
      expect(after[table], table).toBe(0);
    }
    const { rowCount } = await pool.query('SELECT 1 FROM users WHERE id = $1', [
      user.id,
    ]);
    expect(rowCount).toBe(0);
    expect(await countUserData(pool, other.id)).toEqual(otherBefore);
  });

  it('[TC-01-02] the correct password clears the refresh cookie with the same Path', async () => {
    const user = await registerUser();

    const res = await deleteMe(user.token, { password: PASSWORD });

    const header = res.headers['set-cookie'] as unknown as string[];
    const cleared = header.find((c) => c.startsWith(`${COOKIE_NAME}=;`));
    expect(cleared).toBeDefined();
    expect(cleared).toContain('Path=/api/auth');
    expect(cleared).toContain('HttpOnly');
    expect(cleared).toContain('Secure');
    expect(cleared).toContain('SameSite=Strict');
  });

  it('[TC-01-02] the old access token returns 401 on GET /api/me after deletion', async () => {
    const user = await registerUser();

    await deleteMe(user.token, { password: PASSWORD });
    const res = await getMe(user.token);

    expect(res.status).toBe(401);
  });

  it('[TC-01-02] a second DELETE with the old token returns 401', async () => {
    const user = await registerUser();
    await deleteMe(user.token, { password: PASSWORD });

    const res = await deleteMe(user.token, { password: PASSWORD });

    expect(res.status).toBe(401);
  });

  it('[TC-01-02] the refresh cookie of a deleted user no longer refreshes', async () => {
    const user = await registerUser();
    await deleteMe(user.token, { password: PASSWORD });

    const res = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', user.cookie);

    expect(res.status).toBe(401);
  });

  it('[TC-01-02] a missing, empty or non-string password returns 400 and deletes nothing', async () => {
    const user = await registerUser();
    const before = await countUserData(pool, user.id);

    for (const body of [{}, { password: '' }, { password: 48271936 }]) {
      const res = await deleteMe(user.token, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(ErrorResponseSchema.parse(res.body).error.code).toBe(
        'VALIDATION_ERROR',
      );
      expect(JSON.stringify(res.body)).not.toContain('48271936');
    }
    const noBody = await deleteMe(user.token);
    expect(noBody.status).toBe(400);

    expect(await countUserData(pool, user.id)).toEqual(before);
  });

  it('[TC-01-02] DELETE /api/me without a token returns 401', async () => {
    const res = await request(app.getHttpServer())
      .delete('/api/me')
      .send({ password: PASSWORD });

    expect(res.status).toBe(401);
  });

  it('[TC-01-02] the reference tables survive the deletion', async () => {
    const user = await registerUser();
    const before = await countReferenceData(pool);
    expect(before.mistake_categories).toBeGreaterThan(0);
    expect(before.theory_links).toBeGreaterThan(0);

    await deleteMe(user.token, { password: PASSWORD });

    expect(await countReferenceData(pool)).toEqual(before);
    const probe = await pool.query('SELECT 1 FROM theory_links WHERE id = $1', [
      theoryLinkId,
    ]);
    expect(probe.rowCount).toBe(1);
  });

  it('[TC-01-02] DELETE /api/me is documented with a bearer requirement', async () => {
    const docs = await request(app.getHttpServer()).get('/api/docs-json');
    const operation = (
      docs.body as {
        paths: Record<string, Record<string, { security?: unknown }>>;
      }
    ).paths['/api/me']?.['delete'];

    expect(operation?.security).toEqual([{ bearer: [] }]);
  });

  it('[TC-01-06] each user reads their own data and deleting B changes none of A', async () => {
    const a = await registerUser();
    const b = await registerUser();

    const meA = MeSchema.parse((await getMe(a.token)).body);
    const meB = MeSchema.parse((await getMe(b.token)).body);
    expect(meA).toEqual({ id: a.id, email: a.email, consentAt: null });
    expect(meB).toEqual({ id: b.id, email: b.email, consentAt: null });

    const aBefore = await countUserData(pool, a.id);
    const aUserBefore = await pool.query('SELECT * FROM users WHERE id = $1', [
      a.id,
    ]);

    expect((await deleteMe(b.token, { password: PASSWORD })).status).toBe(204);

    expect(await countUserData(pool, a.id)).toEqual(aBefore);
    expect(
      (await pool.query('SELECT * FROM users WHERE id = $1', [a.id])).rows,
    ).toEqual(aUserBefore.rows);
    expect(MeSchema.parse((await getMe(a.token)).body)).toEqual(meA);
  });

  it('[TC-01-06] logout of B does not revoke the refresh tokens of A', async () => {
    const a = await registerUser();
    const b = await registerUser();

    const res = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', b.cookie);

    expect(res.status).toBe(204);
    const { rows } = await pool.query<{ revoked: number }>(
      `SELECT count(*) FILTER (WHERE revoked_at IS NOT NULL)::int AS revoked
       FROM refresh_tokens WHERE user_id = $1`,
      [a.id],
    );
    expect(rows[0]?.revoked).toBe(0);
    const refreshed = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', a.cookie);
    expect(refreshed.status).toBe(200);
  });
});
