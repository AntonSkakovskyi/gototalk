import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DRIZZLE, PG_POOL } from '../../../src/core/db/db.tokens.js';
import type { Database } from '../../../src/core/db/db.tokens.js';
import { ReportRepository } from '../../../src/modules/report/persistence/report.repository.js';
import { registerUser } from '../../support/api-client.js';
import {
  REPORT_STARTED_AT,
  insertMistake,
} from '../../support/report-fixtures.js';
import {
  insertFinished,
  insertUtterance,
} from '../../support/session-fixtures.js';
import { createTestApp } from '../../support/test-app.js';
import { resetUserData } from '../../support/test-db.js';

describe('report category aggregates in SQL', () => {
  let app: INestApplication;
  let pool: pg.Pool;
  let repository: ReportRepository;
  const theoryLinkIds: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    pool = app.get<pg.Pool>(PG_POOL);
    repository = new ReportRepository(app.get<Database>(DRIZZLE));
  });

  afterAll(async () => {
    await pool.query('DELETE FROM theory_links WHERE id = ANY($1::uuid[])', [
      theoryLinkIds,
    ]);
    await app.close();
  });

  beforeEach(async () => {
    await resetUserData(pool);
  });

  async function newOwnedSession(): Promise<{
    userId: string;
    sessionId: string;
  }> {
    const { id: userId } = await registerUser(app);
    const sessionId = await insertFinished(
      pool,
      userId,
      'Topic',
      REPORT_STARTED_AT,
    );
    return { userId, sessionId };
  }

  it('[TC-05-01] counts categories without the false mistakes, ordered by count then code', async () => {
    const { userId, sessionId } = await newOwnedSession();
    const first = await insertUtterance(pool, sessionId, 1, 'user', 'one');
    const second = await insertUtterance(pool, sessionId, 2, 'user', 'two');
    await insertMistake(pool, first, 'verb_tense');
    await insertMistake(pool, second, 'verb_tense');
    await insertMistake(pool, first, 'collocation');
    await insertMistake(pool, second, 'articles');
    await insertMistake(pool, first, 'prepositions');
    await insertMistake(pool, first, 'word_order', { isFalse: true });
    await insertMistake(pool, second, 'word_order', { isFalse: true });

    const categories = await repository.categories(userId, sessionId);

    expect(categories).toEqual([
      { category: 'verb_tense', titleUk: expect.any(String), count: 2 },
      { category: 'articles', titleUk: expect.any(String), count: 1 },
      { category: 'collocation', titleUk: expect.any(String), count: 1 },
      { category: 'prepositions', titleUk: expect.any(String), count: 1 },
    ]);
    const { rows } = await pool.query<{ title_uk: string }>(
      `SELECT title_uk FROM mistake_categories WHERE code = 'verb_tense'`,
    );
    expect(categories[0]?.titleUk).toBe(rows[0]?.title_uk);
  });

  it('[TC-05-01] returns every category, the top-three cut is not made in SQL', async () => {
    const { userId, sessionId } = await newOwnedSession();
    const utterance = await insertUtterance(pool, sessionId, 1, 'user', 'one');
    for (const category of [
      'articles',
      'collocation',
      'other',
      'word_order',
      'verb_tense',
    ]) {
      await insertMistake(pool, utterance, category);
    }

    const categories = await repository.categories(userId, sessionId);

    expect(categories.map((item) => item.category)).toEqual([
      'articles',
      'collocation',
      'other',
      'verb_tense',
      'word_order',
    ]);
  });

  it('[TC-05-01] ignores mistakes of other sessions', async () => {
    const { userId, sessionId } = await newOwnedSession();
    const { sessionId: otherId } = await newOwnedSession();
    const utterance = await insertUtterance(pool, otherId, 1, 'user', 'x');
    await insertMistake(pool, utterance, 'articles');

    expect(await repository.categories(userId, sessionId)).toEqual([]);
  });

  it('[TC-05-01] gives at most two examples per category in answer order and skips false or suggestion-less mistakes', async () => {
    const { userId, sessionId } = await newOwnedSession();
    const first = await insertUtterance(pool, sessionId, 1, 'user', 'one');
    const second = await insertUtterance(pool, sessionId, 3, 'user', 'two');
    await pool.query(
      `INSERT INTO mistakes (utterance_id, category, original, suggestion, start_pos, end_pos)
       VALUES ($1, 'verb_tense', 'second-pos', 'S2', 10, 13),
              ($1, 'verb_tense', 'first-pos', 'S1', 0, 3),
              ($2, 'verb_tense', 'later-answer', 'S3', 0, 3),
              ($1, 'verb_tense', 'no-suggestion', NULL, 20, 23),
              ($1, 'articles', 'article', 'the article', 0, 3)`,
      [first, second],
    );
    await insertMistake(pool, first, 'articles', {
      isFalse: true,
      suggestion: 'FALSE',
    });

    const examples = await repository.examples(userId, sessionId, [
      'verb_tense',
      'articles',
    ]);

    expect(examples.get('verb_tense')).toEqual([
      { original: 'first-pos', suggestion: 'S1' },
      { original: 'second-pos', suggestion: 'S2' },
    ]);
    expect(examples.get('articles')).toEqual([
      { original: 'article', suggestion: 'the article' },
    ]);
  });

  it('[TC-05-01] limits examples to the requested categories and returns nothing for an empty list', async () => {
    const { userId, sessionId } = await newOwnedSession();
    const utterance = await insertUtterance(pool, sessionId, 1, 'user', 'one');
    await insertMistake(pool, utterance, 'verb_tense');
    await insertMistake(pool, utterance, 'articles', { pos: 10 });

    const examples = await repository.examples(userId, sessionId, ['articles']);

    expect([...examples.keys()]).toEqual(['articles']);
    expect((await repository.examples(userId, sessionId, [])).size).toBe(0);
  });

  it('[TC-05-01] returns no categories or examples of a foreign session', async () => {
    const { sessionId } = await newOwnedSession();
    const { id: strangerId } = await registerUser(app);
    const utterance = await insertUtterance(pool, sessionId, 1, 'user', 'one');
    await insertMistake(pool, utterance, 'articles');

    expect(await repository.categories(strangerId, sessionId)).toEqual([]);
    expect(
      (await repository.examples(strangerId, sessionId, ['articles'])).size,
    ).toBe(0);
  });

  it('[TC-05-06] returns theory links per category ordered by title, with no entry for a category without links', async () => {
    const marker = randomUUID();
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO theory_links (category, title, url) VALUES
         ('conditionals', $1, 'https://example.com/b'),
         ('conditionals', $2, 'https://example.com/a')
       RETURNING id`,
      [`${marker} B link`, `${marker} A link`],
    );
    theoryLinkIds.push(...rows.map((row) => row.id));

    const links = await repository.theoryLinks(['conditionals', 'l1_calque']);

    const own = links
      .get('conditionals')
      ?.filter((link) => link.title.startsWith(marker));
    expect(own?.map((link) => link.title)).toEqual([
      `${marker} A link`,
      `${marker} B link`,
    ]);
    expect(own?.[0]).toEqual({
      id: expect.any(String),
      title: `${marker} A link`,
      url: 'https://example.com/a',
    });
    expect(links.get('l1_calque') ?? []).toEqual([]);
    expect((await repository.theoryLinks([])).size).toBe(0);
  });
});
