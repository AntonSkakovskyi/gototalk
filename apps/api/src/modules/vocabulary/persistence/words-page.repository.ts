import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type { Word } from '@gototalk/shared';
import type { KeysetPosition } from '../../../common/keyset-cursor.js';
import { olderThan, toKeysetPage } from '../../../common/keyset-page.js';
import type { KeysetPage } from '../../../common/keyset-page.js';
import { DRIZZLE } from '../../../core/db/db.tokens.js';
import type { Database } from '../../../core/db/db.tokens.js';
import { words } from '../../../core/db/schema.js';
import { WORD_COLUMNS, toWord } from './word-view.js';

@Injectable()
export class WordsPageRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async listPage(
    userId: string,
    { after, limit }: { after?: KeysetPosition; limit: number },
  ): Promise<KeysetPage<Word>> {
    const rows = await this.db
      .select(WORD_COLUMNS)
      .from(words)
      .where(
        and(
          eq(words.userId, userId),
          after ? olderThan(words.createdAt, words.id, after) : undefined,
        ),
      )
      .orderBy(desc(words.createdAt), desc(words.id))
      .limit(limit + 1);
    // created_at stays raw text: a JS Date would truncate microseconds and break the keyset
    return toKeysetPage(
      rows,
      limit,
      (row) => ({ t: row.createdAt, id: row.id }),
      toWord,
    );
  }
}
