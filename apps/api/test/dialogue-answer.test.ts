import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import {
  ANSWER_TEXT_MAX,
  SessionDetailsSchema,
  UtteranceSchema,
} from '@gototalk/shared';
import type { SessionDetails } from '@gototalk/shared';
import type pg from 'pg';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { PG_POOL } from '../src/core/db/db.tokens.js';
import { SPEECH_RECOGNITION_PORT } from '../src/integrations/speech-recognition/speech-recognition.port.js';
import { AnswersService } from '../src/modules/dialogue/answers.service.js';
import {
  MISSING_USER_ID,
  expectError,
  grantConsent,
  registerUser,
  tokenOfMissingUser,
} from './support/api-client.js';
import { createTestApp } from './support/test-app.js';
import { resetUserData } from './support/test-db.js';

const PLAN = {
  topic: 'Weekend plans',
  topicSource: 'suggested',
  questions: [
    'What are you doing this weekend?',
    'Who do you usually spend it with?',
    'Where do you like to go?',
    'What did you do last weekend?',
    'What would be your perfect weekend?',
  ],
};

interface UtteranceRow {
  seq: number;
  role: string;
  text_verbatim: string;
  text_clean: string | null;
  analysis_status: string;
}

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

  const answer = (token: string, sessionId: string, body: object) =>
    request(app.getHttpServer())
      .post(`/api/sessions/${sessionId}/utterances`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  async function startedSession(): Promise<{
    id: string;
    token: string;
    session: SessionDetails;
  }> {
    const user = await registerUser(app);
    await grantConsent(app, user.token);
    const res = await request(app.getHttpServer())
      .post('/api/sessions')
      .set('Authorization', `Bearer ${user.token}`)
      .send(PLAN);
    expect(res.status).toBe(201);
    const session = SessionDetailsSchema.parse(res.body);
    return { id: user.id, token: user.token, session };
  }

  async function utteranceRows(sessionId: string): Promise<UtteranceRow[]> {
    const { rows } = await pool.query<UtteranceRow>(
      `SELECT seq, role, text_verbatim, text_clean, analysis_status
         FROM utterances WHERE session_id = $1 ORDER BY seq`,
      [sessionId],
    );
    return rows;
  }

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
