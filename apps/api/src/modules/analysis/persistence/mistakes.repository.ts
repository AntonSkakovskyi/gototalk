import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import type { MistakeView } from '@gototalk/shared';
import { DRIZZLE } from '../../../core/db/db.tokens.js';
import type { Database, DbTransaction } from '../../../core/db/db.tokens.js';
import { mistakes, sessions, utterances } from '../../../core/db/schema.js';
import { toMistakeView } from '../../session/lib/mistake-view.js';
import {
  MistakeNotFoundError,
  MistakeSessionNotFoundError,
} from '../mistakes.errors.js';
import { PatternsRepository } from './patterns.repository.js';

@Injectable()
export class MistakesRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly patterns: PatternsRepository,
  ) {}

  /** Idempotent: only the call that flips the flag lowers the pattern frequency. */
  markFalse(
    userId: string,
    sessionId: string,
    mistakeId: string,
  ): Promise<MistakeView> {
    return this.db.transaction(async (tx) => {
      await this.requireSession(tx, userId, sessionId);
      // The row lock of this UPDATE makes a concurrent twin wait, then match nothing
      const [flipped] = await tx
        .update(mistakes)
        .set({ isFalse: true })
        .where(
          and(
            eq(mistakes.id, mistakeId),
            eq(mistakes.isFalse, false),
            inArray(
              mistakes.utteranceId,
              tx
                .select({ id: utterances.id })
                .from(utterances)
                .where(eq(utterances.sessionId, sessionId)),
            ),
          ),
        )
        .returning({ category: mistakes.category });
      if (flipped) {
        await this.patterns.decrement(tx, userId, flipped.category);
      }
      return this.readView(tx, sessionId, mistakeId);
    });
  }

  private async requireSession(
    tx: DbTransaction,
    userId: string,
    sessionId: string,
  ): Promise<void> {
    const [session] = await tx
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));
    if (!session) throw new MistakeSessionNotFoundError();
  }

  private async readView(
    tx: DbTransaction,
    sessionId: string,
    mistakeId: string,
  ): Promise<MistakeView> {
    const [row] = await tx
      .select({ mistake: mistakes })
      .from(mistakes)
      .innerJoin(utterances, eq(utterances.id, mistakes.utteranceId))
      .where(
        and(eq(mistakes.id, mistakeId), eq(utterances.sessionId, sessionId)),
      );
    const view = row ? toMistakeView(row.mistake) : null;
    if (!view) throw new MistakeNotFoundError();
    return view;
  }
}
