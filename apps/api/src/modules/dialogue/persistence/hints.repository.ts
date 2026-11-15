import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq } from 'drizzle-orm';
import { DRIZZLE } from '../../../core/db/db.tokens.js';
import type {
  Database,
  DbExecutor,
  DbTransaction,
} from '../../../core/db/db.tokens.js';
import { hints, sessions, utterances } from '../../../core/db/schema.js';
import { SessionWordsRepository } from '../../vocabulary/persistence/session-words.repository.js';
import { WordsRepository } from '../../vocabulary/persistence/words.repository.js';
import { AnswerNotExpectedError } from '../dialogue.errors.js';
import { lockActiveSession } from '../../session/session-lock.js';
import {
  SessionFinishedError,
  SessionNotFoundError,
} from '../../session/session.errors.js';

export interface CurrentQuestion {
  id: string;
  text: string;
  /** 1-based position among the assistant questions of the session. */
  number: number;
}

export interface HintToSave {
  userId: string;
  sessionId: string;
  question: CurrentQuestion;
  record: HintRecord;
}

export type HintRecord =
  | { kind: 'phrase_start'; text: string }
  | { kind: 'translation'; lemma: string; translationUk: string };

@Injectable()
export class HintsRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly words: WordsRepository,
    private readonly sessionWords: SessionWordsRepository,
  ) {}

  /** Unlocked pre-check: the session must be active and have a question to hint on. */
  async currentQuestion(
    userId: string,
    sessionId: string,
  ): Promise<CurrentQuestion> {
    const [session] = await this.db
      .select({ status: sessions.status })
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));
    if (!session) throw new SessionNotFoundError();
    if (session.status !== 'active') throw new SessionFinishedError();
    const last = await this.lastQuestion(this.db, sessionId);
    if (!last) throw new AnswerNotExpectedError();
    const [asked] = await this.db
      .select({ total: count() })
      .from(utterances)
      .where(
        and(
          eq(utterances.sessionId, sessionId),
          eq(utterances.role, 'assistant'),
        ),
      );
    return { ...last, number: asked?.total ?? 1 };
  }

  /** Re-checks the session and its current question under the row lock, so nothing stale is stored. */
  save({ userId, sessionId, question, record }: HintToSave): Promise<void> {
    return this.db.transaction(async (tx) => {
      await lockActiveSession(tx, userId, sessionId);
      const current = await this.lastQuestion(tx, sessionId);
      if (current?.id !== question.id) throw new AnswerNotExpectedError();
      const { text, wordId } = await this.resolve(tx, userId, record);
      await tx.insert(hints).values({
        sessionId,
        utteranceId: question.id,
        kind: record.kind,
        text,
        wordId,
      });
      if (wordId) {
        await this.sessionWords.link(tx, userId, sessionId, [wordId]);
      }
    });
  }

  /** The last utterance when it is an assistant question; an answer without a next question yields none. */
  private async lastQuestion(
    executor: DbExecutor,
    sessionId: string,
  ): Promise<{ id: string; text: string } | undefined> {
    const [last] = await executor
      .select({
        id: utterances.id,
        text: utterances.textVerbatim,
        role: utterances.role,
      })
      .from(utterances)
      .where(eq(utterances.sessionId, sessionId))
      .orderBy(desc(utterances.seq))
      .limit(1);
    return last?.role === 'assistant'
      ? { id: last.id, text: last.text }
      : undefined;
  }

  private async resolve(
    tx: DbTransaction,
    userId: string,
    record: HintRecord,
  ): Promise<{ text: string; wordId: string | null }> {
    if (record.kind === 'phrase_start') {
      return { text: record.text, wordId: null };
    }
    const wordId = await this.words.addFromHint(tx, userId, record);
    return { text: `${record.lemma} = ${record.translationUk}`, wordId };
  }
}
