import type { INestApplication } from '@nestjs/common';
import { LearnerModelSchema, MistakeViewSchema } from '@gototalk/shared';
import type pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PG_POOL } from '../src/core/db/db.tokens.js';
import { fetchDetails } from './support/dialogue-flow.js';
import {
  analysedLearner,
  frequencies,
  patchMistake,
  setFrequency,
} from './support/mistakes-flow.js';
import { createTestApp } from './support/test-app.js';
import { resetUserData } from './support/test-db.js';

describe('PATCH /api/sessions/:id/mistakes/:mistakeId', () => {
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

  it('[TC-04-09] marks the mistake false and lowers only its category frequency', async () => {
    const { learner, verbTense } = await analysedLearner(app);
    expect(await frequencies(pool, learner.id)).toEqual({
      verb_tense: 1,
      word_order: 1,
    });

    const res = await patchMistake(
      app,
      learner.token,
      learner.session.id,
      verbTense.id,
    );

    expect(res.status).toBe(200);
    expect(MistakeViewSchema.parse(res.body)).toEqual({
      ...verbTense,
      isFalse: true,
    });
    expect(await frequencies(pool, learner.id)).toEqual({
      verb_tense: 0,
      word_order: 1,
    });
  });

  it('[TC-04-09] answers 200 again without a second decrement', async () => {
    const { learner, verbTense } = await analysedLearner(app);
    await setFrequency(pool, learner.id, 'verb_tense', 5);

    const first = await patchMistake(
      app,
      learner.token,
      learner.session.id,
      verbTense.id,
    );
    const second = await patchMistake(
      app,
      learner.token,
      learner.session.id,
      verbTense.id,
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(await frequencies(pool, learner.id)).toMatchObject({
      verb_tense: 4,
    });
  });

  it('[TC-04-09] decrements once for two concurrent requests', async () => {
    const { learner, verbTense } = await analysedLearner(app);
    await setFrequency(pool, learner.id, 'verb_tense', 5);

    const results = await Promise.all([
      patchMistake(app, learner.token, learner.session.id, verbTense.id),
      patchMistake(app, learner.token, learner.session.id, verbTense.id),
    ]);

    expect(results.map((res) => res.status)).toEqual([200, 200]);
    expect(await frequencies(pool, learner.id)).toMatchObject({
      verb_tense: 4,
    });
  });

  it('[TC-04-09] takes one off an accumulated frequency', async () => {
    const { learner, verbTense } = await analysedLearner(app);
    await setFrequency(pool, learner.id, 'verb_tense', 4);

    await patchMistake(app, learner.token, learner.session.id, verbTense.id);

    expect(await frequencies(pool, learner.id)).toMatchObject({
      verb_tense: 3,
    });
  });

  it('[TC-04-01] never lowers the frequency below zero', async () => {
    const { learner, verbTense } = await analysedLearner(app);
    await setFrequency(pool, learner.id, 'verb_tense', 0);

    const res = await patchMistake(
      app,
      learner.token,
      learner.session.id,
      verbTense.id,
    );

    expect(res.status).toBe(200);
    expect(await frequencies(pool, learner.id)).toMatchObject({
      verb_tense: 0,
    });
  });

  it('[TC-04-09] shows the flag in the session details', async () => {
    const { learner, verbTense, wordOrder } = await analysedLearner(app);
    await patchMistake(app, learner.token, learner.session.id, verbTense.id);

    const details = await fetchDetails(app, learner);

    const shown = details.utterances.flatMap((u) => u.mistakes);
    expect(shown).toEqual([
      { ...verbTense, isFalse: true },
      { ...wordOrder, isFalse: false },
    ]);
  });

  it('[TC-04-09] drops the category from the weak areas once its frequency is zero', async () => {
    const { learner, verbTense } = await analysedLearner(app);
    const weakAreas = async () =>
      LearnerModelSchema.parse(
        (
          await request(app.getHttpServer())
            .get('/api/profile/learner-model')
            .set('Authorization', `Bearer ${learner.token}`)
        ).body,
      ).weakAreas.map((area) => area.category);
    expect((await weakAreas()).sort()).toEqual(['verb_tense', 'word_order']);

    await patchMistake(app, learner.token, learner.session.id, verbTense.id);

    expect(await weakAreas()).toEqual(['word_order']);
  });

  it('[TC-04-09] works on a finished session', async () => {
    const { learner, verbTense } = await analysedLearner(app);
    await pool.query(
      `UPDATE sessions SET status = 'finished', ended_at = now() WHERE id = $1`,
      [learner.session.id],
    );

    const res = await patchMistake(
      app,
      learner.token,
      learner.session.id,
      verbTense.id,
    );

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: verbTense.id, isFalse: true });
    expect(await frequencies(pool, learner.id)).toMatchObject({
      verb_tense: 0,
    });
  });
});
