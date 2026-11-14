import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { WordSchema } from '@gototalk/shared';
import type pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PG_POOL } from '../src/core/db/db.tokens.js';
import {
  expectError,
  registerUser,
  tokenOfMissingUser,
} from './support/api-client.js';
import { seedWords } from './support/dialogue-flow.js';
import { createTestApp } from './support/test-app.js';
import { resetUserData } from './support/test-db.js';

interface WordRow {
  id: string;
  lemma: string;
  translation_uk: string | null;
  state: string;
  source: string;
}

describe('PATCH /api/words/:id', () => {
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

  function patchWord(token: string | null, id: string, body?: unknown) {
    const patch = request(app.getHttpServer()).patch(`/api/words/${id}`);
    if (token) patch.set('Authorization', `Bearer ${token}`);
    return body === undefined ? patch : patch.send(body as object);
  }

  async function seedOne(userId: string, state: string): Promise<string> {
    await seedWords(pool, userId, [['harvest', state]]);
    const { rows } = await pool.query<{ id: string }>(
      'SELECT id FROM words WHERE user_id = $1',
      [userId],
    );
    return rows[0]!.id;
  }

  async function readWord(id: string): Promise<WordRow> {
    const { rows } = await pool.query<WordRow>(
      'SELECT id, lemma, translation_uk, state, source FROM words WHERE id = $1',
      [id],
    );
    return rows[0]!;
  }

  it('[TC-05-05] moves a word new -> partial -> passive -> new and persists each state', async () => {
    const user = await registerUser(app);
    const id = await seedOne(user.id, 'new');

    for (const state of ['partial', 'passive', 'new']) {
      const res = await patchWord(user.token, id, { state });

      expect(res.status).toBe(200);
      expect(WordSchema.parse(res.body)).toMatchObject({ id, state });
      expect((await readWord(id)).state).toBe(state);
    }
  });

  it('[TC-05-05] is idempotent when the word is already in the requested state', async () => {
    const user = await registerUser(app);
    const id = await seedOne(user.id, 'new');

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const res = await patchWord(user.token, id, { state: 'partial' });

      expect(res.status).toBe(200);
      expect(WordSchema.parse(res.body).state).toBe('partial');
    }
    expect((await readWord(id)).state).toBe('partial');
  });

  it('[TC-05-05] leaves lemma, source and translation untouched', async () => {
    const user = await registerUser(app);
    const id = await seedOne(user.id, 'new');
    await pool.query(
      `UPDATE words SET translation_uk = 'урожай', source = 'hint' WHERE id = $1`,
      [id],
    );
    const before = await readWord(id);

    const res = await patchWord(user.token, id, { state: 'passive' });

    expect(WordSchema.parse(res.body)).toEqual({
      id,
      lemma: 'harvest',
      translationUk: 'урожай',
      state: 'passive',
      source: 'hint',
    });
    expect(await readWord(id)).toEqual({ ...before, state: 'passive' });
  });

  it('[TC-05-05] works for a user without consent', async () => {
    const user = await registerUser(app);
    const id = await seedOne(user.id, 'new');

    const res = await patchWord(user.token, id, { state: 'passive' });

    expect(res.status).toBe(200);
  });

  it.each([
    ['active', { state: 'active' }],
    ['an unknown state', { state: 'mastered' }],
    ['a missing state', {}],
    ['a non-string state', { state: 3 }],
    ['an array body', ['new']],
    ['no body', undefined],
  ])('[TC-05-05] rejects %s with 400 VALIDATION_ERROR', async (_name, body) => {
    const user = await registerUser(app);
    const id = await seedOne(user.id, 'passive');

    const res = await patchWord(user.token, id, body);

    expectError(res, 400, 'VALIDATION_ERROR');
    expect((await readWord(id)).state).toBe('passive');
  });

  it('[TC-05-05] answers 409 WORD_ALREADY_ACTIVE for an active word and keeps it active', async () => {
    const user = await registerUser(app);
    const id = await seedOne(user.id, 'active');

    for (const state of ['new', 'partial', 'passive']) {
      const res = await patchWord(user.token, id, { state });

      expectError(res, 409, 'WORD_ALREADY_ACTIVE');
    }
    expect((await readWord(id)).state).toBe('active');
  });

  it('[TC-05-05] answers an identical 404 WORD_NOT_FOUND for a foreign, unknown and malformed id', async () => {
    const owner = await registerUser(app);
    const stranger = await registerUser(app);
    const id = await seedOne(owner.id, 'new');

    const responses = [
      await patchWord(stranger.token, id, { state: 'passive' }),
      await patchWord(stranger.token, randomUUID(), { state: 'passive' }),
      await patchWord(stranger.token, 'not-a-uuid', { state: 'passive' }),
    ];

    for (const res of responses) {
      expectError(res, 404, 'WORD_NOT_FOUND');
    }
    expect(new Set(responses.map((res) => JSON.stringify(res.body))).size).toBe(
      1,
    );
    expect((await readWord(id)).state).toBe('new');
  });

  it('[TC-05-05] answers 404 for a deleted user with a still-valid token', async () => {
    const res = await patchWord(await tokenOfMissingUser(app), randomUUID(), {
      state: 'new',
    });

    expectError(res, 404, 'WORD_NOT_FOUND');
  });

  it('[TC-05-05] answers 401 without a token', async () => {
    const res = await patchWord(null, randomUUID(), { state: 'new' });

    expectError(res, 401, 'UNAUTHORIZED');
  });

  it('[TC-05-05] ends parallel updates in one of the requested states and never active', async () => {
    const user = await registerUser(app);
    const id = await seedOne(user.id, 'new');

    const responses = await Promise.all(
      ['partial', 'passive', 'partial', 'passive', 'new'].map((state) =>
        patchWord(user.token, id, { state }),
      ),
    );

    for (const res of responses) expect(res.status).toBe(200);
    expect(['new', 'partial', 'passive']).toContain((await readWord(id)).state);
  });
});
