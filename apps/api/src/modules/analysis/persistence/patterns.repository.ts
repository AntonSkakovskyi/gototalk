import { Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import type { MistakeCategoryCode } from '@gototalk/shared';
import type { DbExecutor } from '../../../core/db/db.tokens.js';
import { mistakePatterns } from '../../../core/db/schema.js';

export interface PatternIncrement {
  category: MistakeCategoryCode;
  count: number;
}

@Injectable()
export class PatternsRepository {
  /** Adds the counts to the user's pattern frequencies and returns the pattern ids by category. */
  async increment(
    executor: DbExecutor,
    userId: string,
    increments: PatternIncrement[],
  ): Promise<Map<string, string>> {
    if (increments.length === 0) return new Map();
    // Fixed category order keeps row locks consistent across concurrent transactions of one user
    const ordered = [...increments].sort((a, b) =>
      a.category.localeCompare(b.category),
    );
    const patterns = await executor
      .insert(mistakePatterns)
      .values(
        ordered.map(({ category, count }) => ({
          userId,
          category,
          frequency: count,
          lastSeenAt: sql`clock_timestamp()`,
        })),
      )
      .onConflictDoUpdate({
        target: [mistakePatterns.userId, mistakePatterns.category],
        set: {
          frequency: sql`${mistakePatterns.frequency} + excluded.frequency`,
          lastSeenAt: sql`clock_timestamp()`,
        },
      })
      .returning({
        id: mistakePatterns.id,
        category: mistakePatterns.category,
      });
    return new Map(patterns.map(({ id, category }) => [category, id]));
  }

  async decrement(
    executor: DbExecutor,
    userId: string,
    category: string,
  ): Promise<void> {
    await executor
      .update(mistakePatterns)
      .set({ frequency: sql`GREATEST(${mistakePatterns.frequency} - 1, 0)` })
      .where(
        and(
          eq(mistakePatterns.userId, userId),
          eq(mistakePatterns.category, category),
        ),
      );
  }
}
