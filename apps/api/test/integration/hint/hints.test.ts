import type { INestApplication } from '@nestjs/common';
import { HintResultSchema } from '@gototalk/shared';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PG_POOL } from '../../../src/core/db/db.tokens.js';
import { LANGUAGE_MODEL_PORT } from '../../../src/integrations/language-model/language-model.port.js';
import { ControllableLanguageModel } from '../../support/controllable-language-model.js';
import {
  MISTAKEN_ANSWER,
  analyse,
  SEEDED_WORD_SOURCE,
  seedWords,
  sessionWordRows,
  startLearner,
  submitAnswer,
  utteranceRows,
} from '../../support/dialogue-flow.js';
import {
  hintRows,
  hintedWordRows,
  postHint,
} from '../../support/hints-flow.js';
import { createTestApp } from '../../support/test-app.js';
import { resetUserData } from '../../support/test-db.js';

describe('hints', () => {
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

  it('[TC-04-10] returns a phrase start and stores it against the first question', async () => {
    const learner = await startLearner(app);

    const res = await postHint(app, learner.token, learner.session.id, {
      kind: 'phrase_start',
    });

    expect(res.status).toBe(200);
    expect(HintResultSchema.parse(res.body)).toEqual({
      kind: 'phrase_start',
      text: 'In my opinion…',
    });
    const [question] = await utteranceRows(pool, learner.session.id);
    expect(await hintRows(pool, learner.session.id)).toEqual([
      {
        kind: 'phrase_start',
        text: 'In my opinion…',
        utterance_id: question?.id,
        word_id: null,
      },
    ]);
    expect(await hintedWordRows(pool, learner.id)).toEqual([]);
    expect(await sessionWordRows(pool, learner.session.id)).toEqual([]);
  });

  it('[TC-04-10] hints on the latest question after the first one was answered', async () => {
    const learner = await startLearner(app);
    const answerId = await submitAnswer(app, learner, MISTAKEN_ANSWER);
    await analyse(app, learner, answerId);

    const res = await postHint(app, learner.token, learner.session.id, {
      kind: 'phrase_start',
    });

    expect(res.body).toEqual({
      kind: 'phrase_start',
      text: 'One thing I remember is…',
    });
    const rows = await utteranceRows(pool, learner.session.id);
    expect(rows).toHaveLength(3);
    expect((await hintRows(pool, learner.session.id))[0]?.utterance_id).toBe(
      rows[2]?.id,
    );
  });

  it('[TC-04-10] stores a translated word as a new hint word and links the hint to it', async () => {
    const learner = await startLearner(app);

    const res = await postHint(app, learner.token, learner.session.id, {
      kind: 'translation',
      word: '  зустріч ',
    });

    expect(res.status).toBe(200);
    expect(HintResultSchema.parse(res.body)).toEqual({
      kind: 'translation',
      word: 'meeting',
    });
    const [word] = await hintedWordRows(pool, learner.id);
    expect(word).toMatchObject({
      lemma: 'meeting',
      translation_uk: 'зустріч',
      state: 'new',
      source: 'hint',
      times_used: 0,
    });
    const [question] = await utteranceRows(pool, learner.session.id);
    expect(await hintRows(pool, learner.session.id)).toEqual([
      {
        kind: 'translation',
        text: 'meeting = зустріч',
        utterance_id: question?.id,
        word_id: word?.id,
      },
    ]);
  });

  it('[TC-04-10] does not duplicate a word that is hinted again', async () => {
    const learner = await startLearner(app);
    const body = { kind: 'translation', word: 'зустріч' };

    await postHint(app, learner.token, learner.session.id, body);
    const second = await postHint(app, learner.token, learner.session.id, body);

    expect(second.status).toBe(200);
    const words = await hintedWordRows(pool, learner.id);
    expect(words).toHaveLength(1);
    const hints = await hintRows(pool, learner.session.id);
    expect(hints.map((hint) => hint.word_id)).toEqual([
      words[0]?.id,
      words[0]?.id,
    ]);
  });

  it('[TC-04-10] concurrent hints for the same new word create one word and both succeed', async () => {
    const learner = await startLearner(app);
    const body = { kind: 'translation', word: 'зустріч' };

    const responses = await Promise.all([
      postHint(app, learner.token, learner.session.id, body),
      postHint(app, learner.token, learner.session.id, body),
    ]);

    expect(responses.map((res) => res.status)).toEqual([200, 200]);
    const words = await hintedWordRows(pool, learner.id);
    expect(words).toHaveLength(1);
    expect(
      (await hintRows(pool, learner.session.id)).map((hint) => hint.word_id),
    ).toEqual([words[0]?.id, words[0]?.id]);
  });

  it.each(['passive', 'active'])(
    '[TC-04-10] keeps the state and counters of an existing %s word, whatever its case',
    async (state) => {
      const learner = await startLearner(app);
      await seedWords(pool, learner.id, [['Meeting', state]]);

      const res = await postHint(app, learner.token, learner.session.id, {
        kind: 'translation',
        word: 'зустріч',
      });

      expect(res.body).toEqual({ kind: 'translation', word: 'meeting' });
      const words = await hintedWordRows(pool, learner.id);
      expect(words).toEqual([
        expect.objectContaining({
          lemma: 'Meeting',
          state,
          source: SEEDED_WORD_SOURCE,
          times_used: 1,
          translation_uk: null,
        }),
      ]);
      expect((await hintRows(pool, learner.session.id))[0]?.word_id).toBe(
        words[0]?.id,
      );
    },
  );

  it('[TC-04-10] returns word null and stores nothing for an unknown word', async () => {
    const learner = await startLearner(app);

    const res = await postHint(app, learner.token, learner.session.id, {
      kind: 'translation',
      word: 'абракадабра',
    });

    expect(res.status).toBe(200);
    expect(HintResultSchema.parse(res.body)).toEqual({
      kind: 'translation',
      word: null,
    });
    expect(await hintRows(pool, learner.session.id)).toEqual([]);
    expect(await hintedWordRows(pool, learner.id)).toEqual([]);
    expect(await sessionWordRows(pool, learner.session.id)).toEqual([]);
  });

  it('[TC-05-01] links a newly hinted word to the session', async () => {
    const learner = await startLearner(app);

    await postHint(app, learner.token, learner.session.id, {
      kind: 'translation',
      word: 'зустріч',
    });

    expect(await sessionWordRows(pool, learner.session.id)).toEqual([
      { lemma: 'meeting', state: 'new', source: 'hint' },
    ]);
  });

  it.each(['partial', 'passive', 'active'])(
    '[TC-05-01] links an existing %s word to the session without changing its state',
    async (state) => {
      const learner = await startLearner(app);
      await seedWords(pool, learner.id, [['Meeting', state]]);

      await postHint(app, learner.token, learner.session.id, {
        kind: 'translation',
        word: 'зустріч',
      });

      expect(await sessionWordRows(pool, learner.session.id)).toEqual([
        { lemma: 'Meeting', state, source: SEEDED_WORD_SOURCE },
      ]);
    },
  );
});
