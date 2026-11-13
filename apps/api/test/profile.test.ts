import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  AuthResponseSchema,
  ErrorResponseSchema,
  ProfileSchema,
} from '@gototalk/shared';
import type pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PG_POOL } from '../src/core/db/db.tokens.js';
import { createTestApp } from './support/test-app.js';
import { resetUserData } from './support/test-db.js';

const PASSWORD = 'correct-horse-battery';
const MISSING_USER_ID = '6f1c2a0e-4b8d-4f7e-9a53-0c7d2f1b9e11';

describe('Profile endpoints', () => {
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

  async function registerUser() {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: `${randomUUID()}@example.com`, password: PASSWORD });
    const { accessToken, user } = AuthResponseSchema.parse(res.body);
    return { token: accessToken, id: user.id };
  }

  const getProfile = (token: string) =>
    request(app.getHttpServer())
      .get('/api/profile')
      .set('Authorization', `Bearer ${token}`);

  const putProfile = (token: string, body: unknown) =>
    request(app.getHttpServer())
      .put('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send(body as object);

  const tokenOfMissingUser = () =>
    app.get(JwtService).signAsync({ sub: MISSING_USER_ID });

  it('[TC-02-02] GET /api/profile returns 404 PROFILE_NOT_FOUND before the profile exists', async () => {
    const { token } = await registerUser();

    const res = await getProfile(token);

    expect(res.status).toBe(404);
    expect(ErrorResponseSchema.parse(res.body).error.code).toBe(
      'PROFILE_NOT_FOUND',
    );
  });

  it('[TC-02-02] PUT /api/profile creates the profile and GET returns the same data', async () => {
    const { token } = await registerUser();
    const body = { level: 'B1', scenes: ['work_meetings', 'Ordering coffee'] };

    const created = await putProfile(token, body);

    expect(created.status).toBe(200);
    const profile = ProfileSchema.parse(created.body);
    expect(profile).toMatchObject(body);
    const age = Date.now() - new Date(profile.updatedAt).getTime();
    expect(age).toBeLessThan(60_000);

    const read = await getProfile(token);
    expect(read.status).toBe(200);
    expect(ProfileSchema.parse(read.body)).toEqual(profile);
  });

  it('[TC-02-02] a second PUT replaces level and scenes and moves updatedAt forward', async () => {
    const { id, token } = await registerUser();
    await putProfile(token, { level: 'A2', scenes: ['travel'] });
    await pool.query(
      "UPDATE profiles SET updated_at = '2020-01-02 03:04:05+00' WHERE user_id = $1",
      [id],
    );

    const updated = await putProfile(token, {
      level: 'C1',
      scenes: ['interviews', 'small_talk'],
    });

    expect(updated.status).toBe(200);
    const profile = ProfileSchema.parse(updated.body);
    expect(profile.level).toBe('C1');
    expect(profile.scenes).toEqual(['interviews', 'small_talk']);
    expect(new Date(profile.updatedAt).getTime()).toBeGreaterThan(
      new Date('2020-01-02T03:04:05.000Z').getTime(),
    );

    const { rows } = await pool.query(
      'SELECT count(*) FROM profiles WHERE user_id = $1',
      [id],
    );
    expect(Number(rows[0]?.count)).toBe(1);
  });

  it('[TC-02-02] scenes are trimmed and stored as given', async () => {
    const { token } = await registerUser();

    const res = await putProfile(token, {
      level: 'B2',
      scenes: ['  travel  ', 'Ordering coffee'],
    });

    expect(res.status).toBe(200);
    expect(ProfileSchema.parse(res.body).scenes).toEqual([
      'travel',
      'Ordering coffee',
    ]);
  });

  it.each([
    ['a level outside the list', { level: 'A1', scenes: ['travel'] }],
    ['empty scenes', { level: 'B1', scenes: [] }],
    ['a missing level', { scenes: ['travel'] }],
    ['duplicate scenes', { level: 'B1', scenes: ['travel', 'travel'] }],
  ])(
    '[TC-02-02] PUT /api/profile with %s returns 400 VALIDATION_ERROR',
    async (_name, body) => {
      const { token } = await registerUser();

      const res = await putProfile(token, body);

      expect(res.status).toBe(400);
      expect(ErrorResponseSchema.parse(res.body).error.code).toBe(
        'VALIDATION_ERROR',
      );
      expect((await getProfile(token)).status).toBe(404);
    },
  );

  it('[TC-02-02] PUT /api/profile returns 401 when the user no longer exists', async () => {
    const res = await putProfile(await tokenOfMissingUser(), {
      level: 'B1',
      scenes: ['travel'],
    });

    expect(res.status).toBe(401);
    expect(ErrorResponseSchema.parse(res.body).error.code).toBe('UNAUTHORIZED');
  });

  it('[TC-02-02] GET /api/profile returns 404 when the user no longer exists', async () => {
    const res = await getProfile(await tokenOfMissingUser());

    expect(res.status).toBe(404);
  });

  it('[TC-02-02] user B never sees or changes the profile of user A', async () => {
    const a = await registerUser();
    const b = await registerUser();
    await putProfile(a.token, { level: 'C1', scenes: ['interviews'] });

    expect((await getProfile(b.token)).status).toBe(404);

    await putProfile(b.token, { level: 'A2', scenes: ['travel'] });

    const profileA = ProfileSchema.parse((await getProfile(a.token)).body);
    expect(profileA.level).toBe('C1');
    expect(profileA.scenes).toEqual(['interviews']);
  });

  it('[TC-02-02] profile routes return 401 without a token', async () => {
    const read = await request(app.getHttpServer()).get('/api/profile');
    const write = await request(app.getHttpServer())
      .put('/api/profile')
      .send({ level: 'B1', scenes: ['travel'] });

    expect(read.status).toBe(401);
    expect(write.status).toBe(401);
  });
});
