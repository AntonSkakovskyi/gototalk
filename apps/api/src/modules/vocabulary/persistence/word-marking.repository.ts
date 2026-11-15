import { Inject, Injectable } from '@nestjs/common';
import { and, eq, ne } from 'drizzle-orm';
import type { Word, WordState } from '@gototalk/shared';
import { DRIZZLE } from '../../../core/db/db.tokens.js';
import type { Database } from '../../../core/db/db.tokens.js';
import { words } from '../../../core/db/schema.js';
import { WORD_COLUMNS, toWord } from '../word-view.js';

const ACTIVE: WordState = 'active';

export type MarkStateResult = Word | 'not_found' | 'active';

@Injectable()
export class WordMarkingRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async markState(
    userId: string,
    wordId: string,
    state: WordState,
  ): Promise<MarkStateResult> {
    // The state guard lives in the UPDATE so a concurrent promotion to active can never be overwritten
    const [updated] = await this.db
      .update(words)
      .set({ state })
      .where(
        and(
          eq(words.id, wordId),
          eq(words.userId, userId),
          ne(words.state, ACTIVE),
        ),
      )
      .returning(WORD_COLUMNS);
    if (updated) return toWord(updated);
    const [existing] = await this.db
      .select({ id: words.id })
      .from(words)
      .where(and(eq(words.id, wordId), eq(words.userId, userId)));
    return existing ? 'active' : 'not_found';
  }
}
