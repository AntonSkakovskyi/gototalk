import { Injectable } from '@nestjs/common';
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import type { WordState } from '@gototalk/shared';
import type { DbExecutor } from '../../../core/db/db.tokens.js';
import { words } from '../../../core/db/schema.js';

const ACTIVE: WordState = 'active';
const PROMOTED_FROM: WordState[] = ['passive', 'partial'];

@Injectable()
export class WordsRepository {
  async recordUsage(
    executor: DbExecutor,
    userId: string,
    candidates: string[],
  ): Promise<number> {
    if (candidates.length === 0) return 0;
    const updated = await executor
      .update(words)
      .set({
        timesUsed: sql`${words.timesUsed} + 1`,
        lastUsedAt: sql`clock_timestamp()`,
        state: sql`CASE WHEN ${inArray(words.state, PROMOTED_FROM)} THEN ${ACTIVE} ELSE ${words.state} END`,
      })
      .where(
        and(
          eq(words.userId, userId),
          ne(words.state, ACTIVE),
          sql`lower(${words.lemma}) = ANY(${sql.param(candidates)}::text[])`,
        ),
      )
      .returning({ id: words.id });
    return updated.length;
  }

  /** Adds a hinted word as new, or finds the existing one without changing its state; returns the word id. */
  async addFromHint(
    executor: DbExecutor,
    userId: string,
    word: { lemma: string; translationUk: string },
  ): Promise<string> {
    // No conflict target: the unique index is on the expression (user_id, lower(lemma))
    await executor
      .insert(words)
      .values({
        userId,
        lemma: word.lemma,
        translationUk: word.translationUk,
        source: 'hint',
        state: 'new',
      })
      .onConflictDoNothing();
    const [row] = await executor
      .select({ id: words.id })
      .from(words)
      .where(
        and(
          eq(words.userId, userId),
          sql`lower(${words.lemma}) = lower(${word.lemma})`,
        ),
      );
    if (!row) throw new Error('Hinted word lookup returned no row');
    return row.id;
  }

  /** Adds missing lemmas as new session words; returns the ids of all requested lemmas, existing words untouched. */
  async addFromSession(
    executor: DbExecutor,
    userId: string,
    lemmas: string[],
  ): Promise<string[]> {
    if (lemmas.length === 0) return [];
    // No conflict target: the unique index is on the expression (user_id, lower(lemma))
    await executor
      .insert(words)
      .values(
        lemmas.map((lemma) => ({
          userId,
          lemma,
          source: 'session',
          state: 'new',
        })),
      )
      .onConflictDoNothing();
    const rows = await executor
      .select({ id: words.id })
      .from(words)
      .where(
        and(
          eq(words.userId, userId),
          sql`lower(${words.lemma}) = ANY(${sql.param(lemmas.map((lemma) => lemma.toLowerCase()))}::text[])`,
        ),
      );
    return rows.map((row) => row.id);
  }
}
