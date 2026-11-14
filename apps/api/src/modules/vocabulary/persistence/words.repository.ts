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
}
