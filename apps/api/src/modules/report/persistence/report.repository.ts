import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import {
  MistakeCategoryCodeSchema,
  SessionStatusSchema,
  WordSourceSchema,
  WordStateSchema,
} from '@gototalk/shared';
import type {
  MistakeCategoryCode,
  SessionStatus,
  Word,
} from '@gototalk/shared';
import { DRIZZLE } from '../../../core/db/db.tokens.js';
import type { Database } from '../../../core/db/db.tokens.js';
import { pgTimestampToDate } from '../../../core/db/pg-timestamp.js';
import {
  mistakeCategories,
  mistakes,
  sessionReports,
  sessionWords,
  sessions,
  theoryLinks,
  utterances,
  words,
} from '../../../core/db/schema.js';
import { lockSession } from '../../session/persistence/lock-session.js';

export interface OwnedSession {
  id: string;
  status: SessionStatus;
  startedAt: Date;
}

export interface SessionStats {
  answers: number;
  durationSeconds: number;
}

export interface CategoryCount {
  category: MistakeCategoryCode;
  titleUk: string;
  count: number;
}

export interface MistakeExample {
  original: string;
  suggestion: string;
}

export interface TheoryLinkRow {
  id: string;
  title: string;
  url: string;
}

export interface StoredSummary {
  summary: string;
  promptVersion: string | null;
  model: string | null;
}

export interface SummaryToSave {
  summary: string;
  promptVersion: string;
  model: string;
}

const DEFAULT_EXAMPLES_PER_CATEGORY = 2;

@Injectable()
export class ReportRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findOwnedSession(
    userId: string,
    sessionId: string,
  ): Promise<OwnedSession | null> {
    const [row] = await this.db
      .select({
        id: sessions.id,
        status: sessions.status,
        startedAt: sessions.startedAt,
      })
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));
    if (!row) return null;
    return {
      id: row.id,
      status: SessionStatusSchema.parse(row.status),
      startedAt: pgTimestampToDate(row.startedAt),
    };
  }

  /** The duration runs from the session start to the last answer, in whole seconds. */
  async stats(sessionId: string): Promise<SessionStats> {
    const { rows } = await this.db.execute<{
      answers: number;
      duration_seconds: number;
    }>(sql`
      SELECT count(u.id)::int AS answers,
             COALESCE(
               GREATEST(floor(EXTRACT(EPOCH FROM max(u.created_at) - s.started_at)), 0),
               0
             )::int AS duration_seconds
      FROM ${sessions} s
      LEFT JOIN ${utterances} u ON u.session_id = s.id AND u.role = 'user'
      WHERE s.id = ${sessionId}
      GROUP BY s.started_at
    `);
    const row = rows[0];
    return {
      answers: row?.answers ?? 0,
      durationSeconds: row?.duration_seconds ?? 0,
    };
  }

  /** Every category with a real (not false) mistake in the session, most frequent first. */
  async categories(sessionId: string): Promise<CategoryCount[]> {
    const count = sql<number>`count(*)::int`;
    const rows = await this.db
      .select({
        category: mistakes.category,
        titleUk: mistakeCategories.titleUk,
        count,
      })
      .from(mistakes)
      .innerJoin(utterances, eq(utterances.id, mistakes.utteranceId))
      .innerJoin(
        mistakeCategories,
        eq(mistakeCategories.code, mistakes.category),
      )
      .where(
        and(eq(utterances.sessionId, sessionId), eq(mistakes.isFalse, false)),
      )
      .groupBy(mistakes.category, mistakeCategories.titleUk)
      .orderBy(desc(count), asc(sql`${mistakes.category} COLLATE "C"`));
    return rows.map((row) => ({
      category: MistakeCategoryCodeSchema.parse(row.category),
      titleUk: row.titleUk,
      count: row.count,
    }));
  }

  async examples(
    sessionId: string,
    categoryCodes: string[],
    perCategory = DEFAULT_EXAMPLES_PER_CATEGORY,
  ): Promise<Map<string, MistakeExample[]>> {
    const result = new Map<string, MistakeExample[]>();
    if (categoryCodes.length === 0) return result;
    const { rows } = await this.db.execute<{
      category: string;
      original: string;
      suggestion: string;
    }>(sql`
      SELECT category, original, suggestion
      FROM (
        SELECT m.category, m.original, m.suggestion,
               row_number() OVER (
                 PARTITION BY m.category ORDER BY u.seq, m.start_pos, m.id
               ) AS rn
        FROM ${mistakes} m
        JOIN ${utterances} u ON u.id = m.utterance_id
        WHERE u.session_id = ${sessionId}
          AND NOT m.is_false
          AND m.suggestion IS NOT NULL
          AND m.category = ANY(${sql.param(categoryCodes)}::text[])
      ) ranked
      WHERE rn <= ${perCategory}
      ORDER BY category, rn
    `);
    for (const { category, original, suggestion } of rows) {
      const list = result.get(category) ?? [];
      list.push({ original, suggestion });
      result.set(category, list);
    }
    return result;
  }

  async theoryLinks(
    categoryCodes: string[],
  ): Promise<Map<string, TheoryLinkRow[]>> {
    const result = new Map<string, TheoryLinkRow[]>();
    if (categoryCodes.length === 0) return result;
    const rows = await this.db
      .select({
        category: theoryLinks.category,
        id: theoryLinks.id,
        title: theoryLinks.title,
        url: theoryLinks.url,
      })
      .from(theoryLinks)
      .where(
        sql`${theoryLinks.category} = ANY(${sql.param(categoryCodes)}::text[])`,
      )
      .orderBy(asc(theoryLinks.title), asc(theoryLinks.id));
    for (const { category, ...link } of rows) {
      const list = result.get(category) ?? [];
      list.push(link);
      result.set(category, list);
    }
    return result;
  }

  async sessionWords(userId: string, sessionId: string): Promise<Word[]> {
    const rows = await this.db
      .select({
        id: words.id,
        lemma: words.lemma,
        translationUk: words.translationUk,
        state: words.state,
        source: words.source,
      })
      .from(sessionWords)
      .innerJoin(sessions, eq(sessions.id, sessionWords.sessionId))
      .innerJoin(words, eq(words.id, sessionWords.wordId))
      .where(
        and(
          eq(sessionWords.sessionId, sessionId),
          eq(sessions.userId, userId),
          eq(words.userId, userId),
        ),
      )
      .orderBy(asc(words.createdAt), asc(words.id));
    return rows.map((row) => ({
      ...row,
      state: WordStateSchema.parse(row.state),
      source: WordSourceSchema.parse(row.source),
    }));
  }

  async findStoredSummary(sessionId: string): Promise<StoredSummary | null> {
    const [row] = await this.db
      .select({
        summary: sessionReports.summary,
        promptVersion: sessionReports.promptVersion,
        model: sessionReports.model,
      })
      .from(sessionReports)
      .where(eq(sessionReports.sessionId, sessionId));
    return row ?? null;
  }

  /** The first writer wins: a later summary for the same session is dropped. */
  saveSummary(
    userId: string,
    sessionId: string,
    { summary, promptVersion, model }: SummaryToSave,
  ): Promise<void> {
    return this.db.transaction(async (tx) => {
      const status = await lockSession(tx, userId, sessionId);
      if (status === null) return;
      await tx
        .insert(sessionReports)
        .values({ sessionId, summary, promptVersion, model })
        .onConflictDoNothing({ target: sessionReports.sessionId });
    });
  }
}
