import type { INestApplication } from '@nestjs/common';
import { SessionSchema } from '@gototalk/shared';
import type pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PG_POOL } from '../../../src/core/db/db.tokens.js';
import { startLearner } from '../../support/dialogue-flow.js';
import {
  SessionLockHolder,
  waitForLockWaiter,
} from '../../support/session-lock.js';
import { createTestApp } from '../../support/test-app.js';
import { resetUserData } from '../../support/test-db.js';

describe('finish session locking', () => {
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

  const finish = (token: string, id: string) =>
    request(app.getHttpServer())
      .post(`/api/sessions/${id}/finish`)
      .set('Authorization', `Bearer ${token}`)
      .then((res) => res);

  async function waitOrRelease(holder: SessionLockHolder): Promise<void> {
    try {
      await waitForLockWaiter(pool);
    } catch (error) {
      await holder.release();
      throw error;
    }
  }

  it('[TC-04-04] waits for the session row lock and finishes after it is released', async () => {
    const learner = await startLearner(app);
    const holder = await SessionLockHolder.acquire(pool, learner.session.id);

    const pending = finish(learner.token, learner.session.id);
    await waitOrRelease(holder);
    await holder.release();
    const res = await pending;

    expect(res.status).toBe(200);
    expect(SessionSchema.parse(res.body).status).toBe('finished');
  });

  it('[TC-04-04] keeps the stored ended_at when the session was finished while the call waited', async () => {
    const learner = await startLearner(app);
    const holder = await SessionLockHolder.acquire(pool, learner.session.id);

    const pending = finish(learner.token, learner.session.id);
    await waitOrRelease(holder);
    await holder.finishAndRelease();
    const res = await pending;
    const { rows } = await pool.query<{ ended_at: Date }>(
      'SELECT ended_at FROM sessions WHERE id = $1',
      [learner.session.id],
    );

    expect(res.status).toBe(200);
    expect(SessionSchema.parse(res.body).endedAt).toBe(
      rows[0]?.ended_at.toISOString(),
    );
  });
});
