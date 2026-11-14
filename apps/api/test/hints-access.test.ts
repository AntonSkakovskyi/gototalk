import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { HINT_WORD_MAX } from '@gototalk/shared';
import type pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PG_POOL } from '../src/core/db/db.tokens.js';
import { LANGUAGE_MODEL_PORT } from '../src/integrations/language-model/language-model.port.js';
import {
  expectError,
  grantConsent,
  registerUser,
  tokenOfMissingUser,
} from './support/api-client.js';
import { ControllableLanguageModel } from './support/controllable-language-model.js';
import { startLearner } from './support/dialogue-flow.js';
import { insertUtterance } from './support/session-fixtures.js';
import { hintRows, hintedWordRows, postHint } from './support/hints-flow.js';
import { createTestApp } from './support/test-app.js';
import { resetUserData } from './support/test-db.js';

describe('hints access and validation', () => {
  let app: INestApplication;
  let pool: pg.Pool;
  const model = new ControllableLanguageModel();

  beforeAll(async () => {
    app = await createTestApp({
      providers: [{ token: LANGUAGE_MODEL_PORT, useValue: model }],
    });
    pool = app.get<pg.Pool>(PG_POOL);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetUserData(pool);
    model.reset();
  });

  it.each([
    ['an empty word', { kind: 'translation', word: '' }],
    ['a blank word', { kind: 'translation', word: '   ' }],
    [
      'a word over the limit',
      { kind: 'translation', word: 'я'.repeat(HINT_WORD_MAX + 1) },
    ],
    ['a missing word', { kind: 'translation' }],
    ['a word that is not a string', { kind: 'translation', word: 5 }],
    ['an unknown kind', { kind: 'story' }],
    ['a missing kind', {}],
  ])('[TC-04-10] answers 400 VALIDATION_ERROR for %s', async (_label, body) => {
    const learner = await startLearner(app);

    expectError(
      await postHint(app, learner.token, learner.session.id, body),
      400,
      'VALIDATION_ERROR',
    );

    expect(model.calls.hint).toBe(0);
    expect(await hintRows(pool, learner.session.id)).toEqual([]);
  });

  it('[TC-04-10] accepts a word of exactly the limit', async () => {
    const learner = await startLearner(app);

    const res = await postHint(app, learner.token, learner.session.id, {
      kind: 'translation',
      word: 'я'.repeat(HINT_WORD_MAX),
    });

    expect(res.status).toBe(200);
  });

  it('[TC-04-10] answers 401 without a token and for a deleted user', async () => {
    const learner = await startLearner(app);

    const anonymous = await request(app.getHttpServer())
      .post(`/api/sessions/${learner.session.id}/hints`)
      .send({ kind: 'phrase_start' });
    const deleted = await postHint(
      app,
      await tokenOfMissingUser(app),
      learner.session.id,
      { kind: 'phrase_start' },
    );

    expectError(anonymous, 401, 'UNAUTHORIZED');
    expectError(deleted, 401, 'UNAUTHORIZED');
    expect(model.calls.hint).toBe(0);
  });

  it('[TC-04-10] answers 403 CONSENT_REQUIRED before consent without calling the model', async () => {
    const learner = await startLearner(app);
    const other = await registerUser(app);

    expectError(
      await postHint(app, other.token, learner.session.id, {
        kind: 'phrase_start',
      }),
      403,
      'CONSENT_REQUIRED',
    );
    expect(model.calls.hint).toBe(0);
  });

  it('[TC-04-10] gives the same 404 for a foreign, unknown and malformed session id', async () => {
    const learner = await startLearner(app);
    const intruder = await registerUser(app);
    await grantConsent(app, intruder.token);

    const bodies: unknown[] = [];
    for (const id of [learner.session.id, randomUUID(), 'not-a-uuid']) {
      const res = await postHint(app, intruder.token, id, {
        kind: 'translation',
        word: 'зустріч',
      });
      expectError(res, 404, 'SESSION_NOT_FOUND');
      bodies.push(res.body);
    }

    expect(bodies[1]).toEqual(bodies[0]);
    expect(bodies[2]).toEqual(bodies[0]);
    expect(model.calls.hint).toBe(0);
    expect(await hintRows(pool, learner.session.id)).toEqual([]);
    expect(await hintedWordRows(pool, intruder.id)).toEqual([]);
  });

  it('[TC-04-10] answers 409 SESSION_FINISHED for a finished session without calling the model', async () => {
    const learner = await startLearner(app);
    await pool.query(
      `UPDATE sessions SET status = 'finished', ended_at = now() WHERE id = $1`,
      [learner.session.id],
    );

    expectError(
      await postHint(app, learner.token, learner.session.id, {
        kind: 'translation',
        word: 'зустріч',
      }),
      409,
      'SESSION_FINISHED',
    );
    expect(model.calls.hint).toBe(0);
    expect(await hintRows(pool, learner.session.id)).toEqual([]);
    expect(await hintedWordRows(pool, learner.id)).toEqual([]);
  });

  it('[TC-04-10] answers 409 ANSWER_NOT_EXPECTED when the session has no question', async () => {
    const learner = await startLearner(app);
    await pool.query('DELETE FROM utterances WHERE session_id = $1', [
      learner.session.id,
    ]);

    expectError(
      await postHint(app, learner.token, learner.session.id, {
        kind: 'phrase_start',
      }),
      409,
      'ANSWER_NOT_EXPECTED',
    );
    expect(model.calls.hint).toBe(0);
  });

  it('[TC-04-10] answers 409 ANSWER_NOT_EXPECTED when the last utterance is an answer without a next question', async () => {
    const learner = await startLearner(app);
    await insertUtterance(pool, learner.session.id, 2, 'user', 'I like it');

    expectError(
      await postHint(app, learner.token, learner.session.id, {
        kind: 'phrase_start',
      }),
      409,
      'ANSWER_NOT_EXPECTED',
    );
    expect(model.calls.hint).toBe(0);
    expect(await hintRows(pool, learner.session.id)).toEqual([]);
  });
});
