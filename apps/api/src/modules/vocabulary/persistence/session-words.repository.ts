import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { DbExecutor } from '../../../core/db/db.tokens.js';

@Injectable()
export class SessionWordsRepository {
  /** Links only words that belong to the same user as the session; existing links are kept. */
  async link(
    executor: DbExecutor,
    userId: string,
    sessionId: string,
    wordIds: string[],
  ): Promise<void> {
    if (wordIds.length === 0) return;
    await executor.execute(sql`
      INSERT INTO session_words (session_id, word_id)
      SELECT s.id, w.id
        FROM sessions s
        JOIN words w ON w.user_id = s.user_id
       WHERE s.id = ${sessionId}::uuid
         AND s.user_id = ${userId}::uuid
         AND w.id = ANY(${sql.param(wordIds)}::uuid[])
      ON CONFLICT DO NOTHING
    `);
  }
}
