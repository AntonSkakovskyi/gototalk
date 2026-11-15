import type { INestApplication } from '@nestjs/common';
import { SessionDetailsSchema } from '@gototalk/shared';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PG_POOL } from '../../../src/core/db/db.tokens.js';
import { grantConsent, registerUser } from '../../support/api-client.js';
import {
  insertFinished,
  insertUtterance,
  setPlan,
} from '../../support/session-fixtures.js';
import { createTestApp } from '../../support/test-app.js';
import { resetUserData } from '../../support/test-db.js';

const PLAN = {
  topic: 'Weekend plans',
  topicSource: 'suggested',
  questions: ['q1', 'q2', 'q3', 'q4', 'q5'],
};

describe('GET /api/sessions/:id analysis data', () => {
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

  async function details(sessionId: string, token: string) {
    const res = await request(app.getHttpServer())
      .get(`/api/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    return SessionDetailsSchema.parse(res.body);
  }

  it('[TC-04-01] returns the analysis status and the mistakes of an utterance ordered by start', async () => {
    const { id, token } = await registerUser(app);
    const sessionId = await insertFinished(
      pool,
      id,
      'mistakes',
      '2026-01-01T10:00:00Z',
    );
    await insertUtterance(pool, sessionId, 1, 'assistant', 'Tell me.');
    const userUtteranceId = await insertUtterance(
      pool,
      sessionId,
      2,
      'user',
      'I go to shop yesterday',
      'done',
    );
    const better = [
      { original: 'I go to shop', better: 'I went to the shop' },
      { original: 'yesterday', better: 'yesterday afternoon' },
    ];
    await pool.query(
      'UPDATE utterances SET better_phrasings = $2::jsonb WHERE id = $1',
      [userUtteranceId, JSON.stringify(better)],
    );
    await pool.query(
      `INSERT INTO mistakes (utterance_id, category, original, suggestion, explanation_en, translation_uk, start_pos, end_pos, is_false)
       VALUES ($1, 'articles', 'shop', 'the shop', 'Add an article.', 'Додайте артикль.', 8, 12, true),
              ($1, 'verb_tense', 'go', 'went', 'Use the past simple.', 'Використовуйте Past Simple.', 2, 4, false),
              ($1, 'other', 'ignored', NULL, NULL, NULL, NULL, NULL, false)`,
      [userUtteranceId],
    );

    const [assistant, user] = (await details(sessionId, token)).utterances;

    expect(assistant).toMatchObject({
      analysisStatus: 'skipped',
      mistakes: [],
      better: [],
    });
    expect(user?.analysisStatus).toBe('done');
    expect(user?.better).toEqual(better);
    expect(user?.mistakes).toEqual([
      {
        id: expect.any(String),
        start: 2,
        end: 4,
        original: 'go',
        suggestion: 'went',
        category: 'verb_tense',
        explanationEn: 'Use the past simple.',
        translationUk: 'Використовуйте Past Simple.',
        isFalse: false,
      },
      {
        id: expect.any(String),
        start: 8,
        end: 12,
        original: 'shop',
        suggestion: 'the shop',
        category: 'articles',
        explanationEn: 'Add an article.',
        translationUk: 'Додайте артикль.',
        isFalse: true,
      },
    ]);
  });

  it('[TC-04-01] keeps the mistakes of different utterances apart', async () => {
    const { id, token } = await registerUser(app);
    const sessionId = await insertFinished(
      pool,
      id,
      'two',
      '2026-01-01T10:00:00Z',
    );
    const first = await insertUtterance(
      pool,
      sessionId,
      2,
      'user',
      'I go',
      'done',
    );
    const second = await insertUtterance(
      pool,
      sessionId,
      4,
      'user',
      'He go',
      'done',
    );
    for (const [utteranceId, original] of [
      [first, 'I go'],
      [second, 'He go'],
    ] as const) {
      await pool.query(
        `INSERT INTO mistakes (utterance_id, category, original, suggestion, start_pos, end_pos)
         VALUES ($1, 'verb_tense', $2, 'x', 0, $3)`,
        [utteranceId, original, original.length],
      );
    }

    const { utterances } = await details(sessionId, token);

    expect(utterances.map((u) => u.mistakes.map((m) => m.original))).toEqual([
      ['I go'],
      ['He go'],
    ]);
  });

  it('[TC-03-02] returns exactly the first question for a just started session', async () => {
    const { token } = await registerUser(app);
    await grantConsent(app, token);
    const startRes = await request(app.getHttpServer())
      .post('/api/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send(PLAN);
    expect(startRes.status).toBe(201);
    const started = SessionDetailsSchema.parse(startRes.body);

    const res = await request(app.getHttpServer())
      .get(`/api/sessions/${started.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(SessionDetailsSchema.parse(res.body)).toEqual(started);
    expect(started.utterances).toEqual([
      {
        id: expect.any(String),
        seq: 1,
        role: 'assistant',
        text: 'q1',
        analysisStatus: 'skipped',
        mistakes: [],
        better: [],
      },
    ]);
    expect(started.planRemaining).toBe(4);
    expect(res.body).not.toHaveProperty('plan');
  });

  describe('planRemaining', () => {
    async function remaining(
      plan: unknown,
      assistantTexts: string[],
    ): Promise<number> {
      const { id, token } = await registerUser(app);
      const sessionId = await insertFinished(
        pool,
        id,
        'plan',
        '2026-01-01T10:00:00Z',
      );
      await setPlan(pool, sessionId, plan);
      for (const [index, text] of assistantTexts.entries()) {
        await insertUtterance(pool, sessionId, index + 1, 'assistant', text);
      }
      return (await details(sessionId, token)).planRemaining;
    }

    it('[TC-04-01] planRemaining counts the plan questions not yet asked', async () => {
      const { id, token } = await registerUser(app);
      const sessionId = await insertFinished(
        pool,
        id,
        'plan',
        '2026-01-01T10:00:00Z',
      );
      await setPlan(pool, sessionId, {
        questions: ['q1', 'q2', 'q3', 'q4', 'q5'],
      });
      await insertUtterance(pool, sessionId, 1, 'assistant', 'q1');
      await insertUtterance(pool, sessionId, 2, 'user', 'q2');
      await insertUtterance(
        pool,
        sessionId,
        3,
        'assistant',
        'A follow-up question?',
      );

      expect((await details(sessionId, token)).planRemaining).toBe(4);
    });

    it('[TC-04-01] planRemaining is 0 when every question was asked or the plan is missing', async () => {
      expect(await remaining({ questions: ['a', 'b'] }, ['a', 'b'])).toBe(0);
      expect(await remaining(null, [])).toBe(0);
    });

    it('[TC-04-01] planRemaining is 0 when the stored plan fails the schema', async () => {
      expect(await remaining({ questions: [1, 2] }, [])).toBe(0);
    });

    it('[TC-04-01] planRemaining treats duplicate plan questions as asked together once their text was asked', async () => {
      expect(await remaining({ questions: ['a', 'a', 'b'] }, ['a'])).toBe(1);
    });
  });
});
