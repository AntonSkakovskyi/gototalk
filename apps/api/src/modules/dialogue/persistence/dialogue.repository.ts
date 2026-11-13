import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type { Utterance } from '@gototalk/shared';
import { DRIZZLE } from '../../../core/db/db.tokens.js';
import type { Database, DbTransaction } from '../../../core/db/db.tokens.js';
import { sessions, utterances } from '../../../core/db/schema.js';
import { WordUsageService } from '../../vocabulary/word-usage.service.js';
import {
  AnswerNotExpectedError,
  SessionFinishedError,
  SessionNotFoundError,
} from '../dialogue.errors.js';

export interface AnswerTexts {
  verbatim: string;
  clean: string;
}

@Injectable()
export class DialogueRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly wordUsage: WordUsageService,
  ) {}

  submitAnswer(
    userId: string,
    sessionId: string,
    answer: AnswerTexts,
  ): Promise<Utterance> {
    return this.db.transaction(async (tx) => {
      await this.lockActiveSession(tx, userId, sessionId);
      const nextSeq = await this.nextSeqAfterQuestion(tx, sessionId);

      const [row] = await tx
        .insert(utterances)
        .values({
          sessionId,
          seq: nextSeq,
          role: 'user',
          textVerbatim: answer.verbatim,
          textClean: answer.clean,
          analysisStatus: 'pending',
        })
        .returning({ id: utterances.id, seq: utterances.seq });
      if (!row) throw new Error('Utterance insert returned no row');

      await this.wordUsage.recordUsage(tx, userId, answer.clean);

      return {
        id: row.id,
        seq: row.seq,
        role: 'user',
        text: answer.verbatim,
        analysisStatus: 'pending',
        mistakes: [],
        better: [],
      };
    });
  }

  // The row lock serialises concurrent answers of one session
  private async lockActiveSession(
    tx: DbTransaction,
    userId: string,
    sessionId: string,
  ): Promise<void> {
    const [session] = await tx
      .select({ status: sessions.status })
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
      .for('update');
    if (!session) throw new SessionNotFoundError();
    if (session.status !== 'active') throw new SessionFinishedError();
  }

  private async nextSeqAfterQuestion(
    tx: DbTransaction,
    sessionId: string,
  ): Promise<number> {
    const [last] = await tx
      .select({ seq: utterances.seq, role: utterances.role })
      .from(utterances)
      .where(eq(utterances.sessionId, sessionId))
      .orderBy(desc(utterances.seq))
      .limit(1);
    if (last?.role !== 'assistant') throw new AnswerNotExpectedError();
    return last.seq + 1;
  }
}
