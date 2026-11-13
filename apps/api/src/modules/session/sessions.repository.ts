import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import {
  FeedbackModeSchema,
  SessionStatusSchema,
  TopicSourceSchema,
  UtteranceRoleSchema,
} from '@gototalk/shared';
import type {
  Session,
  SessionDetails,
  StartSessionRequest,
  Utterance,
} from '@gototalk/shared';
import { DRIZZLE } from '../../core/db/db.tokens.js';
import type { Database } from '../../core/db/db.tokens.js';
import { pgTimestampToDate } from '../../core/db/pg-timestamp.js';
import { sessions, users, utterances } from '../../core/db/schema.js';
import { SessionOwnerMissingError } from './session.errors.js';

type SessionRow = typeof sessions.$inferSelect;
type UtteranceRow = typeof utterances.$inferSelect;

function toIso(value: string): string {
  return pgTimestampToDate(value).toISOString();
}

function toSession(row: SessionRow): Session {
  return {
    id: row.id,
    topic: row.topic,
    topicSource: TopicSourceSchema.parse(row.topicSource),
    feedbackMode: FeedbackModeSchema.parse(row.feedbackMode),
    status: SessionStatusSchema.parse(row.status),
    startedAt: toIso(row.startedAt),
    endedAt: row.endedAt === null ? null : toIso(row.endedAt),
  };
}

function toUtterance(row: UtteranceRow): Utterance {
  return {
    id: row.id,
    seq: row.seq,
    role: UtteranceRoleSchema.parse(row.role),
    text: row.textVerbatim,
  };
}

function toSessionDetails(
  session: SessionRow,
  utteranceRows: UtteranceRow[],
): SessionDetails {
  return { ...toSession(session), utterances: utteranceRows.map(toUtterance) };
}

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

@Injectable()
export class SessionsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  start(
    userId: string,
    { topic, topicSource, feedbackMode, questions }: StartSessionRequest,
  ): Promise<SessionDetails> {
    const [firstQuestion] = questions;
    // The schema guarantees five questions; this narrows the index under noUncheckedIndexedAccess
    if (firstQuestion === undefined) {
      throw new Error('A session plan needs at least one question');
    }
    return this.db.transaction(async (tx) => {
      await this.lockOwner(tx, userId);
      await this.finishActive(tx, userId);

      const [session] = await tx
        .insert(sessions)
        .values({
          userId,
          topic,
          topicSource,
          feedbackMode,
          plan: { questions },
          // clock_timestamp() keeps started_at ordered by lock acquisition, unlike now() (transaction start)
          startedAt: sql`clock_timestamp()`,
        })
        .returning();
      if (!session) throw new Error('Session insert returned no row');

      const [utterance] = await tx
        .insert(utterances)
        .values({
          sessionId: session.id,
          seq: 1,
          role: 'assistant',
          textVerbatim: firstQuestion,
          analysisStatus: 'skipped',
        })
        .returning();
      if (!utterance) throw new Error('Utterance insert returned no row');

      return toSessionDetails(session, [utterance]);
    });
  }

  // Serialises one user's session starts so only one session stays active
  private async lockOwner(tx: Tx, userId: string): Promise<void> {
    const locked = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .for('no key update');
    if (locked.length === 0) throw new SessionOwnerMissingError();
  }

  private async finishActive(tx: Tx, userId: string): Promise<void> {
    await tx
      .update(sessions)
      .set({ status: 'finished', endedAt: sql`clock_timestamp()` })
      .where(and(eq(sessions.userId, userId), eq(sessions.status, 'active')));
  }
}
