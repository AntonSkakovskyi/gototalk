import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, gt, sql } from 'drizzle-orm';
import { MistakeCategoryCodeSchema, WordStateSchema } from '@gototalk/shared';
import type { WordState } from '@gototalk/shared';
import { DRIZZLE } from '../../../core/db/db.tokens.js';
import type { Database } from '../../../core/db/db.tokens.js';
import { pgTimestampToDate } from '../../../core/db/pg-timestamp.js';
import { mistakePatterns, words } from '../../../core/db/schema.js';
import type { WeakArea } from '../learner-model.types.js';

type PatternRow = typeof mistakePatterns.$inferSelect;

function toWeakArea(row: PatternRow): WeakArea {
  return {
    category: MistakeCategoryCodeSchema.parse(row.category),
    frequency: row.frequency,
    lastSeenAt: row.lastSeenAt ? pgTimestampToDate(row.lastSeenAt) : null,
  };
}

@Injectable()
export class LearnerModelRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async weakAreas(userId: string, limit: number): Promise<WeakArea[]> {
    const rows = await this.db
      .select()
      .from(mistakePatterns)
      .where(
        and(
          eq(mistakePatterns.userId, userId),
          gt(mistakePatterns.frequency, 0),
        ),
      )
      .orderBy(
        desc(mistakePatterns.frequency),
        sql`${mistakePatterns.lastSeenAt} desc nulls last`,
        mistakePatterns.category,
      )
      .limit(limit);
    return rows.map(toWeakArea);
  }

  async wordStateCounts(
    userId: string,
  ): Promise<Partial<Record<WordState, number>>> {
    const rows = await this.db
      .select({ state: words.state, total: count() })
      .from(words)
      .where(eq(words.userId, userId))
      .groupBy(words.state);
    const counts: Partial<Record<WordState, number>> = {};
    for (const row of rows)
      counts[WordStateSchema.parse(row.state)] = row.total;
    return counts;
  }
}
