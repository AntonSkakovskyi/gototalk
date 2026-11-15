import type { INestApplication } from '@nestjs/common';
import { UtteranceSchema } from '@gototalk/shared';
import type pg from 'pg';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { PG_POOL } from '../../../src/core/db/db.tokens.js';
import { SPEECH_RECOGNITION_PORT } from '../../../src/integrations/speech-recognition/speech-recognition.port.js';
import { expectError } from '../../support/api-client.js';
import { createAnswerClient } from '../../support/answer-api.js';
import { createTestApp } from '../../support/test-app.js';
import { resetUserData } from '../../support/test-db.js';

interface WordRow {
  lemma: string;
  state: string;
  times_used: number;
}

describe('POST /api/sessions/:id/utterances', () => {
  let app: INestApplication;
  let pool: pg.Pool;
  const transcribe = vi.fn();

  beforeAll(async () => {
    app = await createTestApp({
      providers: [{ token: SPEECH_RECOGNITION_PORT, useValue: { transcribe } }],
    });
    pool = app.get<pg.Pool>(PG_POOL);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetUserData(pool);
    transcribe.mockClear();
  });

  const { answer, startedSession, utteranceRows } = createAnswerClient(
    () => app,
    () => pool,
  );

  async function wordRows(userId: string): Promise<Map<string, WordRow>> {
    const { rows } = await pool.query<WordRow>(
      'SELECT lemma, state, times_used FROM words WHERE user_id = $1',
      [userId],
    );
    return new Map(rows.map((row) => [row.lemma, row]));
  }

  async function seedWord(
    userId: string,
    lemma: string,
    state: string,
  ): Promise<void> {
    await pool.query(
      `INSERT INTO words (user_id, lemma, state, times_used) VALUES ($1, $2, $3, 1)`,
      [userId, lemma, state],
    );
  }

  it('[TC-04-03] stores a pending user utterance with verbatim equal to clean and skips speech recognition', async () => {
    const { token, session } = await startedSession();
    const text = 'I very like weekends';

    const res = await answer(token, session.id, { text });

    expect(res.status).toBe(201);
    expect(UtteranceSchema.parse(res.body)).toMatchObject({
      seq: 2,
      role: 'user',
      text,
      analysisStatus: 'pending',
      mistakes: [],
      better: [],
    });
    expect(await utteranceRows(session.id)).toEqual([
      expect.objectContaining({ seq: 1, role: 'assistant' }),
      {
        seq: 2,
        role: 'user',
        text_verbatim: text,
        text_clean: text,
        analysis_status: 'pending',
      },
    ]);
    expect(transcribe).not.toHaveBeenCalled();
  });

  it('[TC-04-03] returns 409 SESSION_FINISHED for a finished session', async () => {
    const { token, session } = await startedSession();
    await pool.query(
      `UPDATE sessions SET status = 'finished', ended_at = now() WHERE id = $1`,
      [session.id],
    );

    expectError(
      await answer(token, session.id, { text: 'Hello' }),
      409,
      'SESSION_FINISHED',
    );
    expect(await utteranceRows(session.id)).toHaveLength(1);
  });

  it('[TC-04-03] returns 409 ANSWER_NOT_EXPECTED when the previous answer has no reply yet', async () => {
    const { token, session } = await startedSession();
    expect((await answer(token, session.id, { text: 'First' })).status).toBe(
      201,
    );

    expectError(
      await answer(token, session.id, { text: 'Second' }),
      409,
      'ANSWER_NOT_EXPECTED',
    );
    expect(await utteranceRows(session.id)).toHaveLength(2);
  });

  it('[TC-04-03] lets exactly one of two parallel answers through', async () => {
    const { token, session } = await startedSession();

    const responses = await Promise.all([
      answer(token, session.id, { text: 'Answer A' }),
      answer(token, session.id, { text: 'Answer B' }),
    ]);

    expect(responses.map((res) => res.status).sort()).toEqual([201, 409]);
    const conflict = responses.find((res) => res.status === 409);
    if (!conflict) throw new Error('Expected one conflict');
    expectError(conflict, 409, 'ANSWER_NOT_EXPECTED');
    const rows = await utteranceRows(session.id);
    expect(rows.map((row) => row.seq)).toEqual([1, 2]);
    expect(rows.filter((row) => row.role === 'user')).toHaveLength(1);
  });

  it('[TC-04-01] promotes passive and partial words to active and counts new ones', async () => {
    const { id, token, session } = await startedSession();
    await seedWord(id, 'deadline', 'passive');
    await seedWord(id, 'budget', 'partial');
    await seedWord(id, 'schedule', 'new');
    await seedWord(id, 'unrelated', 'passive');

    const res = await answer(token, session.id, {
      text: 'The deadline, the budget and the schedule are fine.',
    });

    expect(res.status).toBe(201);
    expect(await wordRows(id)).toEqual(
      new Map([
        ['deadline', { lemma: 'deadline', state: 'active', times_used: 2 }],
        ['budget', { lemma: 'budget', state: 'active', times_used: 2 }],
        ['schedule', { lemma: 'schedule', state: 'new', times_used: 2 }],
        ['unrelated', { lemma: 'unrelated', state: 'passive', times_used: 1 }],
      ]),
    );
  });

  it('[TC-04-01] leaves words untouched when the answer is rejected', async () => {
    const { id, token, session } = await startedSession();
    await seedWord(id, 'deadline', 'passive');
    await answer(token, session.id, { text: 'First' });

    const res = await answer(token, session.id, {
      text: 'The deadline is close',
    });

    expect(res.status).toBe(409);
    expect((await wordRows(id)).get('deadline')).toEqual({
      lemma: 'deadline',
      state: 'passive',
      times_used: 1,
    });
  });
});
