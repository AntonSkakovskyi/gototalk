import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { DRIZZLE } from '../../../core/db/db.tokens.js';
import type { Database } from '../../../core/db/db.tokens.js';
import { sessions, utterances } from '../../../core/db/schema.js';
import { lockSession } from '../../session/session-lock.js';
import type { AnalysisOutcome } from '../mistake-analyzer.types.js';
import { AnalysisWriter } from '../analysis-writer.service.js';

export interface PendingUtterance {
  id: string;
  text: string;
}

@Injectable()
export class PendingAnalysisRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly writer: AnalysisWriter,
  ) {}

  findPending(userId: string, sessionId: string): Promise<PendingUtterance[]> {
    return this.db
      .select({ id: utterances.id, text: utterances.textVerbatim })
      .from(utterances)
      .innerJoin(sessions, eq(sessions.id, utterances.sessionId))
      .where(
        and(
          eq(utterances.sessionId, sessionId),
          eq(sessions.userId, userId),
          eq(utterances.role, 'user'),
          eq(utterances.analysisStatus, 'pending'),
        ),
      )
      .orderBy(asc(utterances.seq));
  }

  /** Returns false when the session no longer exists. The outcome is written only if the utterance is still pending. */
  save(
    userId: string,
    sessionId: string,
    utteranceId: string,
    outcome: AnalysisOutcome,
  ): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const status = await lockSession(tx, userId, sessionId);
      if (status === null) return false;
      await this.writer.save(tx, userId, utteranceId, outcome);
      return true;
    });
  }
}
