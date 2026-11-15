import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import {
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
  WordPageSchema,
} from '@gototalk/shared';
import type { WordPage } from '@gototalk/shared';
import type pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { encodeCursor } from '../src/common/pagination/keyset-cursor.js';
import { PG_POOL } from '../src/core/db/db.tokens.js';
import {
  expectError,
  registerUser,
  tokenOfMissingUser,
} from './support/api-client.js';
import { createTestApp } from './support/test-app.js';
import { resetUserData } from './support/test-db.js';

interface WordOptions {
  state?: string;
  source?: string;
  translation?: string | null;
}

describe('GET /api/words', () => {
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

  async function insertWord(
    userId: string,
    lemma: string,
    createdAt: string,
    { state = 'new', source = 'session', translation = null }: WordOptions = {},
  ): Promise<string> {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO words (user_id, lemma, translation_uk, state, source, created_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [userId, lemma, translation, state, source, createdAt],
    );
    const row = rows[0];
    if (!row) throw new Error('Word insert returned no row');
    return row.id;
  }

  const getWords = (token: string, query = '') =>
    request(app.getHttpServer())
      .get(`/api/words${query}`)
      .set('Authorization', `Bearer ${token}`);

  async function page(token: string, query = ''): Promise<WordPage> {
    const res = await getWords(token, query);
    expect(res.status).toBe(200);
    return WordPageSchema.parse(res.body);
  }

  async function collectAll(token: string, limit: number) {
    const ids: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const cursorQuery: string =
        cursor === null ? '' : `&cursor=${encodeURIComponent(cursor)}`;
      const current: WordPage = await page(
        token,
        `?limit=${limit}${cursorQuery}`,
      );
      ids.push(...current.items.map((item) => item.id));
      cursor = current.nextCursor;
      pages += 1;
      expect(pages).toBeLessThan(50);
    } while (cursor !== null);
    return { ids, pages };
  }

  it('[TC-05-05] lists the words newest first with state, source and translation', async () => {
    const { id, token } = await registerUser(app);
    await insertWord(id, 'alpha', '2026-01-01T10:00:00Z');
    await insertWord(id, 'gamma', '2026-03-01T10:00:00Z', {
      state: 'active',
      source: 'hint',
      translation: 'гама',
    });
    await insertWord(id, 'beta', '2026-02-01T10:00:00Z', {
      state: 'passive',
      source: 'user',
    });

    const result = await page(token);

    expect(result.items).toEqual([
      expect.objectContaining({
        lemma: 'gamma',
        state: 'active',
        source: 'hint',
        translationUk: 'гама',
      }),
      expect.objectContaining({
        lemma: 'beta',
        state: 'passive',
        source: 'user',
        translationUk: null,
      }),
      expect.objectContaining({
        lemma: 'alpha',
        state: 'new',
        source: 'session',
        translationUk: null,
      }),
    ]);
    expect(result.nextCursor).toBeNull();
  });

  it('[TC-05-05] pages of two cover five words without gaps or duplicates', async () => {
    const { id, token } = await registerUser(app);
    const expected: string[] = [];
    for (let day = 1; day <= 5; day += 1) {
      expected.unshift(
        await insertWord(id, `word${day}`, `2026-01-0${day}T10:00:00Z`),
      );
    }

    const first = await page(token, '?limit=2');
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();

    const { ids, pages } = await collectAll(token, 2);
    expect(ids).toEqual(expected);
    expect(pages).toBe(3);
  });

  it('[TC-05-05] returns a null cursor on an exactly full last page', async () => {
    const { id, token } = await registerUser(app);
    await insertWord(id, 'a', '2026-01-01T10:00:00Z');
    await insertWord(id, 'b', '2026-01-02T10:00:00Z');

    const result = await page(token, '?limit=2');

    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBeNull();
  });

  it('[TC-05-05] paginates words with an identical created_at by id', async () => {
    const { id, token } = await registerUser(app);
    const sameTime: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      sameTime.push(
        await insertWord(id, `same${index}`, '2026-01-01T10:00:00Z'),
      );
    }

    const { ids } = await collectAll(token, 2);

    expect(ids).toEqual([...sameTime].sort().reverse());
  });

  it('[TC-05-05] neither skips nor duplicates words that differ only in microseconds', async () => {
    const { id, token } = await registerUser(app);
    const newest = await insertWord(
      id,
      'us789',
      '2026-01-01 10:00:00.123789+00',
    );
    const middle = await insertWord(
      id,
      'us456',
      '2026-01-01 10:00:00.123456+00',
    );
    const oldest = await insertWord(
      id,
      'us000',
      '2026-01-01 10:00:00.123000+00',
    );

    const { ids, pages } = await collectAll(token, 1);

    expect(ids).toEqual([newest, middle, oldest]);
    expect(pages).toBe(3);
  });

  it('[TC-05-05] applies the default page size', async () => {
    const { id, token } = await registerUser(app);
    for (let index = 0; index < PAGE_SIZE_DEFAULT + 1; index += 1) {
      const minute = String(index).padStart(2, '0');
      await insertWord(id, `n${index}`, `2026-01-01T10:${minute}:00Z`);
    }

    const result = await page(token);

    expect(result.items).toHaveLength(PAGE_SIZE_DEFAULT);
    expect(result.nextCursor).not.toBeNull();
  });

  it('[TC-05-05] accepts the maximum limit and rejects values outside 1..max', async () => {
    const { token } = await registerUser(app);

    expect((await getWords(token, `?limit=${PAGE_SIZE_MAX}`)).status).toBe(200);
    for (const limit of [PAGE_SIZE_MAX + 1, 0, -1, 'abc', '1.5', '']) {
      expectError(
        await getWords(token, `?limit=${limit}`),
        400,
        'VALIDATION_ERROR',
      );
    }
  });

  it('[TC-05-05] answers a tampered or garbage cursor with 400 VALIDATION_ERROR', async () => {
    const { token } = await registerUser(app);
    const id = randomUUID();
    const cursors = [
      'garbage',
      '%25%25%25',
      encodeCursor({ t: 'yesterday', id }),
      encodeCursor({ t: '2026-02-31 10:00:00+00', id }),
      encodeCursor({ t: '2026-01-01 10:00:00+00', id: 'not-a-uuid' }),
      'x'.repeat(201),
    ];

    for (const cursor of cursors) {
      expectError(
        await getWords(token, `?cursor=${cursor}`),
        400,
        'VALIDATION_ERROR',
      );
    }
    expectError(await getWords(token, '?cursor='), 400, 'VALIDATION_ERROR');
  });

  it('[TC-05-05] never returns the words of another user', async () => {
    const mine = await registerUser(app);
    const other = await registerUser(app);
    await insertWord(mine.id, 'mine', '2026-01-01T10:00:00Z');
    await insertWord(other.id, 'theirs', '2026-02-01T10:00:00Z');

    const result = await page(mine.token);

    expect(result.items.map((word) => word.lemma)).toEqual(['mine']);
  });

  it('[TC-05-05] ignores the words of another user when a foreign cursor is used', async () => {
    const mine = await registerUser(app);
    const other = await registerUser(app);
    await insertWord(mine.id, 'mine1', '2026-01-01T10:00:00Z');
    await insertWord(mine.id, 'mine2', '2026-01-02T10:00:00Z');
    await insertWord(other.id, 'theirs1', '2026-01-03T10:00:00Z');
    await insertWord(other.id, 'theirs2', '2026-01-04T10:00:00Z');
    const foreign = await page(other.token, '?limit=1');

    const result = await page(
      mine.token,
      `?cursor=${encodeURIComponent(foreign.nextCursor ?? '')}`,
    );

    expect(result.items.map((word) => word.lemma)).toEqual(['mine2', 'mine1']);
  });

  it('[TC-05-05] returns an empty page for a deleted user with a valid token', async () => {
    const token = await tokenOfMissingUser(app);

    expect(await page(token)).toEqual({ items: [], nextCursor: null });
  });

  it('[TC-05-05] returns an empty page for a user without words', async () => {
    const { token } = await registerUser(app);

    expect(await page(token)).toEqual({ items: [], nextCursor: null });
  });

  it('[TC-05-05] works without consent', async () => {
    const { id, token } = await registerUser(app);
    await pool.query('UPDATE users SET consent_at = NULL WHERE id = $1', [id]);
    await insertWord(id, 'quiet', '2026-01-01T10:00:00Z');

    expect((await page(token)).items).toHaveLength(1);
  });

  it('[TC-05-05] reflects a state change made through PATCH /api/words/:id', async () => {
    const { id, token } = await registerUser(app);
    const wordId = await insertWord(id, 'harvest', '2026-01-01T10:00:00Z');

    const patch = await request(app.getHttpServer())
      .patch(`/api/words/${wordId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ state: 'passive' });
    expect(patch.status).toBe(200);

    const result = await page(token);
    expect(result.items).toEqual([
      expect.objectContaining({ id: wordId, state: 'passive' }),
    ]);
  });

  it('[TC-05-05] does not route PATCH /api/words without an id', async () => {
    const { token } = await registerUser(app);

    const res = await request(app.getHttpServer())
      .patch('/api/words')
      .set('Authorization', `Bearer ${token}`)
      .send({ state: 'new' });

    expect(res.status).toBe(404);
  });

  it('[TC-05-05] returns 401 without a token', async () => {
    expectError(
      await request(app.getHttpServer()).get('/api/words'),
      401,
      'UNAUTHORIZED',
    );
  });
});
