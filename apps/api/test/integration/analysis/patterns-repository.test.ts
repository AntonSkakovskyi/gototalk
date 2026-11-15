import type { INestApplication } from '@nestjs/common';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DRIZZLE, PG_POOL } from '../../../src/core/db/db.tokens.js';
import type { Database } from '../../../src/core/db/db.tokens.js';
import { PatternsRepository } from '../../../src/modules/analysis/persistence/patterns.repository.js';
import { registerUser } from '../../support/api-client.js';
import { frequencies } from '../../support/mistakes-flow.js';
import { createTestApp } from '../../support/test-app.js';
import { resetUserData } from '../../support/test-db.js';

describe('PatternsRepository', () => {
  let app: INestApplication;
  let pool: pg.Pool;
  let db: Database;
  let patterns: PatternsRepository;

  beforeAll(async () => {
    app = await createTestApp();
    pool = app.get<pg.Pool>(PG_POOL);
    db = app.get<Database>(DRIZZLE);
    patterns = app.get(PatternsRepository, { strict: false });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetUserData(pool);
  });

  it('[TC-04-01] creates and increments the counters and returns the pattern ids by category', async () => {
    const { id } = await registerUser(app);

    const first = await patterns.increment(db, id, [
      { category: 'word_order', count: 1 },
      { category: 'verb_tense', count: 2 },
    ]);
    const second = await patterns.increment(db, id, [
      { category: 'verb_tense', count: 3 },
    ]);

    expect(await frequencies(pool, id)).toEqual({
      verb_tense: 5,
      word_order: 1,
    });
    expect([...first.keys()].sort()).toEqual(['verb_tense', 'word_order']);
    expect(second.get('verb_tense')).toBe(first.get('verb_tense'));
  });

  it('[TC-04-01] returns an empty map and writes nothing for no increments', async () => {
    const { id } = await registerUser(app);

    expect((await patterns.increment(db, id, [])).size).toBe(0);
    expect(await frequencies(pool, id)).toEqual({});
  });

  it('[TC-04-01] decrements one category and never goes below zero', async () => {
    const { id } = await registerUser(app);
    await patterns.increment(db, id, [
      { category: 'verb_tense', count: 1 },
      { category: 'word_order', count: 2 },
    ]);

    await patterns.decrement(db, id, 'verb_tense');
    await patterns.decrement(db, id, 'verb_tense');
    await patterns.decrement(db, id, 'word_order');

    expect(await frequencies(pool, id)).toEqual({
      verb_tense: 0,
      word_order: 1,
    });
  });

  it('[TC-04-01] leaves other users and a missing category untouched', async () => {
    const owner = await registerUser(app);
    const other = await registerUser(app);
    await patterns.increment(db, other.id, [
      { category: 'verb_tense', count: 2 },
    ]);

    await patterns.decrement(db, owner.id, 'verb_tense');

    expect(await frequencies(pool, owner.id)).toEqual({});
    expect(await frequencies(pool, other.id)).toEqual({ verb_tense: 2 });
  });
});
