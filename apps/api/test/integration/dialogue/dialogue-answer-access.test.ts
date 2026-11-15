import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import type pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PG_POOL } from '../../../src/core/db/db.tokens.js';
import { AnswersService } from '../../../src/modules/dialogue/answers.service.js';
import {
  MISSING_USER_ID,
  expectError,
  grantConsent,
  registerUser,
  tokenOfMissingUser,
} from '../../support/api-client.js';
import { createAnswerClient } from '../../support/answer-api.js';
import { createTestApp } from '../../support/test-app.js';
import { resetUserData } from '../../support/test-db.js';

describe('POST /api/sessions/:id/utterances', () => {
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

  const { answer, startedSession, utteranceRows } = createAnswerClient(
    () => app,
    () => pool,
  );

  it('[TC-04-03] returns 401 without a token', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/sessions/${randomUUID()}/utterances`)
      .send({ text: 'Hello' });

    expectError(res, 401, 'UNAUTHORIZED');
  });

  it('[TC-04-03] returns 401 when the user no longer exists', async () => {
    const res = await answer(await tokenOfMissingUser(app), randomUUID(), {
      text: 'Hello',
    });

    expectError(res, 401, 'UNAUTHORIZED');
  });

  it('[TC-04-03] returns 404 instead of a foreign key failure when the owner disappears after the guard', async () => {
    const { session } = await startedSession();

    await expect(
      app
        .get(AnswersService)
        .submit(MISSING_USER_ID, session.id, { verbatim: 'Hi', clean: 'Hi' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('[TC-04-03] returns 403 CONSENT_REQUIRED before consent and stores nothing', async () => {
    const { session } = await startedSession();
    const other = await registerUser(app);

    expectError(
      await answer(other.token, session.id, { text: 'Hello' }),
      403,
      'CONSENT_REQUIRED',
    );
    expect(await utteranceRows(session.id)).toHaveLength(1);
  });

  it('[TC-04-03] gives the same 404 for a foreign, unknown and malformed session id', async () => {
    const { session } = await startedSession();
    const intruder = await registerUser(app);
    await grantConsent(app, intruder.token);

    const bodies: unknown[] = [];
    for (const id of [session.id, randomUUID(), 'not-a-uuid']) {
      const res = await answer(intruder.token, id, { text: 'Hello' });
      expectError(res, 404, 'SESSION_NOT_FOUND');
      bodies.push(res.body);
    }

    expect(bodies[1]).toEqual(bodies[0]);
    expect(bodies[2]).toEqual(bodies[0]);
    expect(await utteranceRows(session.id)).toHaveLength(1);
  });
});
