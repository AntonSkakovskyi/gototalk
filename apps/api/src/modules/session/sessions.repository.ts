import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  AnalysisStatusSchema,
  BetterPhrasingSchema,
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
import type { Database, DbTransaction } from '../../core/db/db.tokens.js';
import { pgTimestampToDate } from '../../core/db/pg-timestamp.js';
import { mistakes, sessions, users, utterances } from '../../core/db/schema.js';
import { lockSession } from './persistence/lock-session.js';
import { toMistakeView } from './lib/mistake-view.js';
import type { MistakeRow } from './lib/mistake-view.js';
import {
  parsePlanQuestions,
  remainingQuestions,
} from './lib/plan-questions.js';
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

const BetterPhrasingsSchema = z.array(BetterPhrasingSchema);

function toUtterance(row: UtteranceRow, mistakeRows: MistakeRow[]): Utterance {
  const role = UtteranceRoleSchema.parse(row.role);
  return {
    id: row.id,
    seq: row.seq,
    role,
    text: row.textVerbatim,
    analysisStatus: AnalysisStatusSchema.parse(row.analysisStatus),
    mistakes: mistakeRows.flatMap((mistake) => toMistakeView(mistake) ?? []),
    better:
      role === 'user' ? BetterPhrasingsSchema.parse(row.betterPhrasings) : [],
  };
}

function countPlanRemaining(
  plan: unknown,
  utteranceRows: UtteranceRow[],
): number {
  const askedTexts = utteranceRows
    .filter((row) => row.role === 'assistant')
    .map((row) => row.textVerbatim);
  return remainingQuestions(parsePlanQuestions(plan), askedTexts).length;
}

function toSessionDetails(
  session: SessionRow,
  utteranceRows: UtteranceRow[],
  mistakeRows: MistakeRow[],
): SessionDetails {
  const byUtterance = Map.groupBy(mistakeRows, (row) => row.utteranceId);
  return {
    ...toSession(session),
    utterances: utteranceRows.map((row) =>
      toUtterance(row, byUtterance.get(row.id) ?? []),
    ),
    planRemaining: countPlanRemaining(session.plan, utteranceRows),
  };
}

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

      return toSessionDetails(session, [utterance], []);
    });
  }

  listRecent(userId: string, limit: number): Promise<Session[]> {
    return this.db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .orderBy(desc(sessions.startedAt), desc(sessions.id))
      .limit(limit)
      .then((rows) => rows.map(toSession));
  }

  async findDetails(
    userId: string,
    sessionId: string,
  ): Promise<SessionDetails | null> {
    const [session] = await this.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));
    if (!session) return null;
    const rows = await this.db
      .select()
      .from(utterances)
      .where(eq(utterances.sessionId, session.id))
      .orderBy(asc(utterances.seq));
    const mistakeRows =
      rows.length === 0
        ? []
        : await this.db
            .select()
            .from(mistakes)
            .where(
              inArray(
                mistakes.utteranceId,
                rows.map((row) => row.id),
              ),
            )
            .orderBy(asc(mistakes.startPos), asc(mistakes.id));
    return toSessionDetails(session, rows, mistakeRows);
  }

  finish(userId: string, sessionId: string): Promise<Session | null> {
    return this.db.transaction(async (tx) => {
      // The row lock serialises the finish against answers and analysis of the session
      const status = await lockSession(tx, userId, sessionId);
      if (status === null) return null;
      const [row] =
        status === 'active'
          ? await tx
              .update(sessions)
              .set({ status: 'finished', endedAt: sql`clock_timestamp()` })
              .where(eq(sessions.id, sessionId))
              .returning()
          : await tx.select().from(sessions).where(eq(sessions.id, sessionId));
      if (!row) throw new Error('Session row disappeared under its lock');
      return toSession(row);
    });
  }

  // Serialises one user's session starts so only one session stays active
  private async lockOwner(tx: DbTransaction, userId: string): Promise<void> {
    const locked = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .for('no key update');
    if (locked.length === 0) throw new SessionOwnerMissingError();
  }

  private async finishActive(tx: DbTransaction, userId: string): Promise<void> {
    await tx
      .update(sessions)
      .set({ status: 'finished', endedAt: sql`clock_timestamp()` })
      .where(and(eq(sessions.userId, userId), eq(sessions.status, 'active')));
  }
}
