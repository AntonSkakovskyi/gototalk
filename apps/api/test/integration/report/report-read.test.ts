import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { SessionReportSchema } from '@gototalk/shared';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PG_POOL } from '../../../src/core/db/db.tokens.js';
import { LANGUAGE_MODEL_PORT } from '../../../src/integrations/language-model/language-model.port.js';
import { ControllableLanguageModel } from '../../support/controllable-language-model.js';
import {
  MISTAKEN_ANSWER,
  analyse,
  startLearner,
  submitAnswer,
} from '../../support/dialogue-flow.js';
import { postHint } from '../../support/hints-flow.js';
import { patchMistake } from '../../support/mistakes-flow.js';
import {
  finishSession,
  finishedLearner,
  getReport,
  startNextSession,
} from '../../support/report-flow.js';
import { createTestApp } from '../../support/test-app.js';
import { resetUserData } from '../../support/test-db.js';

describe('GET /api/sessions/:id/report', () => {
  let app: INestApplication;
  let pool: pg.Pool;
  const model = new ControllableLanguageModel();
  const theoryLinkIds: string[] = [];

  beforeAll(async () => {
    app = await createTestApp({
      providers: [{ token: LANGUAGE_MODEL_PORT, useValue: model }],
    });
    pool = app.get<pg.Pool>(PG_POOL);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM theory_links WHERE id = ANY($1::uuid[])', [
      theoryLinkIds,
    ]);
    await app.close();
  });

  beforeEach(async () => {
    await resetUserData(pool);
    model.reset();
  });

  async function readReport(token: string, sessionId: string) {
    const res = await getReport(app, token, sessionId);
    expect(res.status).toBe(200);
    return SessionReportSchema.parse(res.body);
  }

  it('[TC-05-02] returns the summary, counts, ordered categories and session words', async () => {
    const learner = await startLearner(app);
    const { utterance } = await analyse(
      app,
      learner,
      await submitAnswer(app, learner, MISTAKEN_ANSWER),
    );
    await analyse(
      app,
      learner,
      await submitAnswer(app, learner, MISTAKEN_ANSWER),
    );
    const falseMistake = utterance.mistakes.find(
      (mistake) => mistake.category === 'word_order',
    );
    const hint = await postHint(app, learner.token, learner.session.id, {
      kind: 'translation',
      word: 'зустріч',
    });
    expect(hint.status).toBe(200);
    const marked = await patchMistake(
      app,
      learner.token,
      learner.session.id,
      falseMistake?.id ?? '',
    );
    expect(marked.status).toBe(200);
    await finishSession(app, learner);

    const report = await readReport(learner.token, learner.session.id);

    expect(report).toMatchObject({
      sessionId: learner.session.id,
      answers: 2,
      summary: {
        status: 'ready',
        text: expect.stringMatching(/^Ви відповіли 2 /),
      },
    });
    expect(
      report.categories.map((item) => [item.category, item.count]),
    ).toEqual([
      ['verb_tense', 2],
      ['word_order', 1],
    ]);
    expect(Number.isInteger(report.durationSeconds)).toBe(true);
    expect(report.durationSeconds).toBeGreaterThanOrEqual(0);
    expect(report.words.map((word) => word.lemma)).toEqual(
      expect.arrayContaining(['meeting', 'went', 'really']),
    );
    expect(model.calls.summarize).toBe(1);
  });

  it('[TC-05-06] lists the theory links of a category that has them, ordered by title', async () => {
    const marker = randomUUID();
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO theory_links (category, title, url) VALUES
         ('word_order', $1, 'https://example.com/b'),
         ('word_order', $2, 'https://example.com/a')
       RETURNING id`,
      [`${marker} B link`, `${marker} A link`],
    );
    theoryLinkIds.push(...rows.map((row) => row.id));
    const learner = await finishedLearner(app);

    const report = await readReport(learner.token, learner.session.id);

    const byCategory = new Map(
      report.categories.map((item) => [item.category, item.theoryLinks]),
    );
    expect(byCategory.get('word_order')).toEqual([
      expect.objectContaining({ title: `${marker} A link` }),
      expect.objectContaining({ title: `${marker} B link` }),
    ]);
    expect(
      byCategory
        .get('verb_tense')
        ?.some((link) => link.title.startsWith(marker)),
    ).toBe(false);
  });

  it('[TC-05-02] does not call the model again on a repeated read', async () => {
    const learner = await finishedLearner(app);
    const first = await readReport(learner.token, learner.session.id);

    const second = await readReport(learner.token, learner.session.id);

    expect(second).toEqual(first);
    expect(model.calls.summarize).toBe(1);
  });

  it('[TC-05-02] generates the report lazily for a session finished by a new start', async () => {
    const learner = await startLearner(app);
    await analyse(
      app,
      learner,
      await submitAnswer(app, learner, MISTAKEN_ANSWER),
    );
    await startNextSession(app, learner.token);
    expect(model.calls.summarize).toBe(0);

    const report = await readReport(learner.token, learner.session.id);

    expect(report.summary.status).toBe('ready');
    expect(report.answers).toBe(1);
    expect(model.calls.summarize).toBe(1);
  });

  it('[TC-05-02] reports no_answers for a session without answers and skips the model', async () => {
    const learner = await finishedLearner(app, []);

    const report = await readReport(learner.token, learner.session.id);

    expect(report).toMatchObject({
      answers: 0,
      summary: { status: 'no_answers' },
      categories: [],
      words: [],
    });
    expect(model.calls.summarize).toBe(0);
  });
});
