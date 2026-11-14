import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import {
  AnalysisStatusSchema,
  SessionStatusSchema,
  UtteranceRoleSchema,
} from '@gototalk/shared';
import { DRIZZLE } from '../../../core/db/db.tokens.js';
import type { Database, DbTransaction } from '../../../core/db/db.tokens.js';
import { sessions, utterances } from '../../../core/db/schema.js';
import { lockSession } from '../../session/persistence/lock-session.js';
import { parsePlanQuestions } from '../../session/lib/plan-questions.js';
import type { AnalysisOutcome } from '../../analysis/mistake-analyzer.types.js';
import {
  SessionNotFoundError,
  UtteranceNotFoundError,
} from '../dialogue.errors.js';
import type { StoredUtterance, TurnState } from '../lib/turn-state.js';
import { AnalysisWriter } from './analysis-writer.js';

export interface TurnWrites {
  analysis: AnalysisOutcome | null;
  /** Text of the next assistant question. */
  reply: string | null;
}

type UtteranceRow = typeof utterances.$inferSelect;

function toStored(row: UtteranceRow): StoredUtterance {
  return {
    id: row.id,
    seq: row.seq,
    role: UtteranceRoleSchema.parse(row.role),
    textVerbatim: row.textVerbatim,
    textClean: row.textClean,
    analysisStatus: AnalysisStatusSchema.parse(row.analysisStatus),
  };
}

@Injectable()
export class TurnRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly analysisWriter: AnalysisWriter,
  ) {}

  async loadState(
    userId: string,
    sessionId: string,
    utteranceId: string,
  ): Promise<TurnState> {
    const [session] = await this.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));
    if (!session) throw new SessionNotFoundError();
    const rows = await this.db
      .select()
      .from(utterances)
      .where(eq(utterances.sessionId, sessionId))
      .orderBy(asc(utterances.seq));
    const stored = rows.map(toStored);
    const target = stored.find(
      ({ id, role }) => id === utteranceId && role === 'user',
    );
    if (!target) throw new UtteranceNotFoundError();
    return {
      sessionActive: SessionStatusSchema.parse(session.status) === 'active',
      topic: session.topic,
      planQuestions: parsePlanQuestions(session.plan),
      utterances: stored,
      target,
    };
  }

  /** Writes only what is still missing, under the session row lock, so duplicate or parallel calls store nothing twice. */
  persist(
    userId: string,
    sessionId: string,
    target: StoredUtterance,
    writes: TurnWrites,
  ): Promise<void> {
    return this.db.transaction(async (tx) => {
      const active = await this.lockSession(tx, userId, sessionId);
      if (writes.analysis) {
        await this.analysisWriter.save(tx, userId, target.id, writes.analysis);
      }
      if (writes.reply !== null && active) {
        await this.insertReply(tx, sessionId, target.seq + 1, writes.reply);
      }
    });
  }

  private async lockSession(
    tx: DbTransaction,
    userId: string,
    sessionId: string,
  ): Promise<boolean> {
    const status = await lockSession(tx, userId, sessionId);
    if (status === null) throw new SessionNotFoundError();
    return SessionStatusSchema.parse(status) === 'active';
  }

  private async insertReply(
    tx: DbTransaction,
    sessionId: string,
    seq: number,
    question: string,
  ): Promise<void> {
    await tx
      .insert(utterances)
      .values({
        sessionId,
        seq,
        role: 'assistant',
        textVerbatim: question,
        analysisStatus: 'skipped',
      })
      .onConflictDoNothing({ target: [utterances.sessionId, utterances.seq] });
  }
}
