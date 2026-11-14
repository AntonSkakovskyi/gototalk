import type { INestApplication } from '@nestjs/common';
import type pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PG_POOL } from '../src/core/db/db.tokens.js';
import {
  expectError,
  grantConsent,
  putProfile,
  registerUser,
} from './support/api-client.js';
import { createTestApp } from './support/test-app.js';
import { resetUserData } from './support/test-db.js';

describe('POST /api/sessions/plan with FAKE_LLM_FAIL=unavailable', () => {
  let app: INestApplication;
  let pool: pg.Pool;

  beforeAll(async () => {
    app = await createTestApp({ env: { FAKE_LLM_FAIL: 'unavailable' } });
    pool = app.get<pg.Pool>(PG_POOL);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetUserData(pool);
  });

  it('[TC-04-08] returns 503 LANGUAGE_MODEL_UNAVAILABLE and stores no session', async () => {
    const { token } = await registerUser(app);
    await grantConsent(app, token);
    await putProfile(app, token, { level: 'B1', scenes: ['small_talk'] });

    const res = await request(app.getHttpServer())
      .post('/api/sessions/plan')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expectError(res, 503, 'LANGUAGE_MODEL_UNAVAILABLE');
    const { rows } = await pool.query<{ count: string }>(
      'SELECT count(*) FROM sessions',
    );
    expect(Number(rows[0]?.count)).toBe(0);
  });
});
