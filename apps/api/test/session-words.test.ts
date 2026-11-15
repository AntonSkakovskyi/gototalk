import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { AuthResponseSchema } from '@gototalk/shared';
import type pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DRIZZLE, PG_POOL } from '../src/core/db/db.tokens.js';
import type { Database } from '../src/core/db/db.tokens.js';
import { SessionWordsRepository } from '../src/modules/vocabulary/persistence/session-words.repository.js';
import { WordsRepository } from '../src/modules/vocabulary/persistence/words.repository.js';
import { createTestApp } from './support/test-app.js';
import { resetUserData } from './support/test-db.js';

const PASSWORD = 'correct-horse-battery';

interface LinkedWord {
  lemma: string;
  state: string;
  source: string;
  translation_uk: string | null;
}

describe('Session words persistence', () => {
  let app: INestApplication;
  let pool: pg.Pool;
  let db: Database;
  let words: WordsRepository;
  let sessionWords: SessionWordsRepository;

  beforeAll(async () => {
    app = await createTestApp();
    pool = app.get<pg.Pool>(PG_POOL);
    db = app.get<Database>(DRIZZLE);
    words = app.get(WordsRepository);
    sessionWords = app.get(SessionWordsRepository);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetUserData(pool);
  });

  async function registerUser(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: `${randomUUID()}@example.com`, password: PASSWORD });
    return AuthResponseSchema.parse(res.body).user.id;
  }

  async function seedSession(
    userId: string,
    status = 'finished',
  ): Promise<string> {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO sessions (user_id, topic, status) VALUES ($1, 'Topic', $2) RETURNING id`,
      [userId, status],
    );
    return rows[0]!.id;
  }

  async function seedWord(
    userId: string,
    lemma: string,
    state: string,
  ): Promise<string> {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO words (user_id, lemma, state, source, translation_uk, times_used)
       VALUES ($1, $2, $3, 'hint', 'переклад', 2) RETURNING id`,
      [userId, lemma, state],
    );
    return rows[0]!.id;
  }

  async function linkedWords(sessionId: string): Promise<LinkedWord[]> {
    const { rows } = await pool.query<LinkedWord>(
      `SELECT w.lemma, w.state, w.source, w.translation_uk
         FROM session_words sw JOIN words w ON w.id = sw.word_id
        WHERE sw.session_id = $1 ORDER BY w.lemma`,
      [sessionId],
    );
    return rows;
  }

  async function countWords(userId: string): Promise<number> {
    const { rows } = await pool.query<{ count: string }>(
      'SELECT count(*) FROM words WHERE user_id = $1',
      [userId],
    );
    return Number(rows[0]?.count);
  }

  async function countLinks(sessionId: string): Promise<number> {
    const { rows } = await pool.query<{ count: string }>(
      'SELECT count(*) FROM session_words WHERE session_id = $1',
      [sessionId],
    );
    return Number(rows[0]?.count);
  }

  async function addAndLink(
    userId: string,
    sessionId: string,
    lemmas: string[],
  ): Promise<string[]> {
    return db.transaction(async (tx) => {
      const ids = await words.addFromSession(tx, userId, lemmas);
      await sessionWords.link(tx, userId, sessionId, ids);
      return ids;
    });
  }

  it('[TC-05-01] creates a new session word and links it to the session', async () => {
    const userId = await registerUser();
    const sessionId = await seedSession(userId);

    const ids = await addAndLink(userId, sessionId, ['went']);

    expect(ids).toHaveLength(1);
    expect(await linkedWords(sessionId)).toEqual([
      { lemma: 'went', state: 'new', source: 'session', translation_uk: null },
    ]);
  });

  it('[TC-05-01] keeps the state, source and translation of an existing word in another case and links it', async () => {
    const userId = await registerUser();
    const sessionId = await seedSession(userId);
    const existingId = await seedWord(userId, 'Went', 'passive');

    const ids = await addAndLink(userId, sessionId, ['went', 'really']);

    expect(ids).toHaveLength(2);
    expect(ids).toContain(existingId);
    expect(await countWords(userId)).toBe(2);
    expect(await linkedWords(sessionId)).toEqual([
      {
        lemma: 'really',
        state: 'new',
        source: 'session',
        translation_uk: null,
      },
      {
        lemma: 'Went',
        state: 'passive',
        source: 'hint',
        translation_uk: 'переклад',
      },
    ]);
    const { rows } = await pool.query<{ times_used: number }>(
      'SELECT times_used FROM words WHERE id = $1',
      [existingId],
    );
    expect(rows[0]?.times_used).toBe(2);
  });

  it('[TC-05-01] is idempotent when called twice', async () => {
    const userId = await registerUser();
    const sessionId = await seedSession(userId);

    const first = await addAndLink(userId, sessionId, ['went', 'really']);
    const second = await addAndLink(userId, sessionId, ['went', 'really']);

    expect([...second].sort()).toEqual([...first].sort());
    expect(await countWords(userId)).toBe(2);
    expect(await countLinks(sessionId)).toBe(2);
  });

  it('[TC-05-01] links the same word to several sessions', async () => {
    const userId = await registerUser();
    const firstSession = await seedSession(userId);
    const secondSession = await seedSession(userId);

    await addAndLink(userId, firstSession, ['went']);
    await addAndLink(userId, secondSession, ['went']);

    expect(await countWords(userId)).toBe(1);
    expect(await countLinks(firstSession)).toBe(1);
    expect(await countLinks(secondSession)).toBe(1);
  });

  it('[TC-05-01] does not link a word of another user', async () => {
    const userId = await registerUser();
    const otherId = await registerUser();
    const sessionId = await seedSession(userId);
    const foreignWordId = await seedWord(otherId, 'went', 'new');

    await db.transaction((tx) =>
      sessionWords.link(tx, userId, sessionId, [foreignWordId]),
    );

    expect(await countLinks(sessionId)).toBe(0);
  });

  it('[TC-05-01] does not link a word to a session of another user', async () => {
    const userId = await registerUser();
    const otherId = await registerUser();
    const foreignSessionId = await seedSession(otherId);
    const wordId = await seedWord(userId, 'went', 'new');

    await db.transaction((tx) =>
      sessionWords.link(tx, userId, foreignSessionId, [wordId]),
    );

    expect(await countLinks(foreignSessionId)).toBe(0);
  });

  it('[TC-05-01] does not touch the word of another user with the same lemma', async () => {
    const userId = await registerUser();
    const otherId = await registerUser();
    const sessionId = await seedSession(userId);
    const foreignWordId = await seedWord(otherId, 'went', 'passive');

    const ids = await addAndLink(userId, sessionId, ['went']);

    expect(ids).not.toContain(foreignWordId);
    expect(await countWords(otherId)).toBe(1);
    expect(await linkedWords(sessionId)).toEqual([
      { lemma: 'went', state: 'new', source: 'session', translation_uk: null },
    ]);
  });

  it('[TC-05-01] does nothing for an empty list', async () => {
    const userId = await registerUser();
    const sessionId = await seedSession(userId);

    const ids = await addAndLink(userId, sessionId, []);

    expect(ids).toEqual([]);
    expect(await countWords(userId)).toBe(0);
    expect(await countLinks(sessionId)).toBe(0);
  });

  it('[TC-05-01] persists nothing when the surrounding transaction rolls back', async () => {
    const userId = await registerUser();
    const sessionId = await seedSession(userId);

    await expect(
      db.transaction(async (tx) => {
        const ids = await words.addFromSession(tx, userId, ['went']);
        await sessionWords.link(tx, userId, sessionId, ids);
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');

    expect(await countWords(userId)).toBe(0);
    expect(await countLinks(sessionId)).toBe(0);
  });
});
