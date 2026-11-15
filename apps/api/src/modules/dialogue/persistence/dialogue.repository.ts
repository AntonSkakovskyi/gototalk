import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq } from 'drizzle-orm';
import type { Utterance } from '@gototalk/shared';
import { DRIZZLE } from '../../../core/db/db.tokens.js';
import type {
  Database,
  DbExecutor,
  DbTransaction,
} from '../../../core/db/db.tokens.js';
import { sessions, utterances } from '../../../core/db/schema.js';
import { WordUsageService } from '../../vocabulary/word-usage.service.js';
import { AnswerNotExpectedError } from '../dialogue.errors.js';
import { lockActiveSession } from '../../session/session-lock.js';
import {
  SessionFinishedError,
  SessionNotFoundError,
} from '../../session/session.errors.js';

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

  /** Cheap unlocked check that an answer is expected; returns the number of user utterances, which is the next answer's index. */
  async answerIndexFor(userId: string, sessionId: string): Promise<number> {
    const [session] = await this.db
      .select({ status: sessions.status })
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));
    if (!session) throw new SessionNotFoundError();
    if (session.status !== 'active') throw new SessionFinishedError();
    const last = await this.lastUtterance(this.db, sessionId);
    if (last?.role !== 'assistant') throw new AnswerNotExpectedError();
    const [answers] = await this.db
      .select({ total: count() })
      .from(utterances)
      .where(
        and(eq(utterances.sessionId, sessionId), eq(utterances.role, 'user')),
      );
    return answers?.total ?? 0;
  }

  submitAnswer(
    userId: string,
    sessionId: string,
    answer: AnswerTexts,
  ): Promise<Utterance> {
    return this.db.transaction(async (tx) => {
      // The row lock serialises concurrent answers of one session
      await lockActiveSession(tx, userId, sessionId);
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

  private async nextSeqAfterQuestion(
    tx: DbTransaction,
    sessionId: string,
  ): Promise<number> {
    const last = await this.lastUtterance(tx, sessionId);
    if (last?.role !== 'assistant') throw new AnswerNotExpectedError();
    return last.seq + 1;
  }

  private async lastUtterance(
    executor: DbExecutor,
    sessionId: string,
  ): Promise<{ seq: number; role: string } | undefined> {
    const [last] = await executor
      .select({ seq: utterances.seq, role: utterances.role })
      .from(utterances)
      .where(eq(utterances.sessionId, sessionId))
      .orderBy(desc(utterances.seq))
      .limit(1);
    return last;
  }
}
