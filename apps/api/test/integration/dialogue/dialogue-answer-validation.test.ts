import { ANSWER_TEXT_MAX } from '@gototalk/shared';
import type { INestApplication } from '@nestjs/common';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PG_POOL } from '../../../src/core/db/db.tokens.js';
import { expectError } from '../../support/api-client.js';
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

  it('[TC-04-03] accepts exactly ANSWER_TEXT_MAX characters and rejects one more', async () => {
    const { token, session } = await startedSession();

    const tooLong = await answer(token, session.id, {
      text: 'a'.repeat(ANSWER_TEXT_MAX + 1),
    });
    const atLimit = await answer(token, session.id, {
      text: 'a'.repeat(ANSWER_TEXT_MAX),
    });

    expectError(tooLong, 400, 'VALIDATION_ERROR');
    expect(atLimit.status).toBe(201);
    expect(await utteranceRows(session.id)).toHaveLength(2);
  });

  it.each([[{ text: '' }], [{ text: '   ' }], [{}], [{ text: 5 }]])(
    '[TC-04-03] rejects the invalid body %j with 400 and stores nothing',
    async (body) => {
      const { token, session } = await startedSession();

      expectError(
        await answer(token, session.id, body),
        400,
        'VALIDATION_ERROR',
      );
      expect(await utteranceRows(session.id)).toHaveLength(1);
    },
  );
});
