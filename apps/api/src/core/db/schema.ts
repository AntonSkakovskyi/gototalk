import {
  pgTable,
  unique,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
  foreignKey,
  check,
  jsonb,
  integer,
  boolean,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable(
  'users',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    email: text().notNull(),
    passwordHash: text('password_hash').notNull(),
    consentAt: timestamp('consent_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [unique('users_email_key').on(table.email)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    topic: text().notNull(),
    topicSource: text('topic_source').default('suggested').notNull(),
    feedbackMode: text('feedback_mode').default('immediate').notNull(),
    status: text().default('active').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true, mode: 'string' }),
    plan: jsonb(),
  },
  (table) => [
    index('idx_sessions_user_start').using(
      'btree',
      table.userId.asc().nullsLast().op('timestamptz_ops'),
      table.startedAt.desc().nullsFirst().op('timestamptz_ops'),
    ),
    uniqueIndex('sessions_one_active_per_user')
      .using('btree', table.userId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(status = 'active'::text)`),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'sessions_user_id_fkey',
    }).onDelete('cascade'),
    check(
      'sessions_topic_source_check',
      sql`topic_source = ANY (ARRAY['suggested'::text, 'custom'::text])`,
    ),
    check(
      'sessions_feedback_mode_check',
      sql`feedback_mode = ANY (ARRAY['immediate'::text, 'deferred'::text])`,
    ),
    check(
      'sessions_status_check',
      sql`status = ANY (ARRAY['active'::text, 'finished'::text])`,
    ),
    check(
      'sessions_plan_check',
      sql`(plan IS NULL) OR ((jsonb_typeof(plan) = 'object'::text) AND (COALESCE(jsonb_typeof((plan -> 'questions'::text)), ''::text) = 'array'::text))`,
    ),
  ],
);

export const goals = pgTable(
  'goals',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    title: text().notNull(),
    scene: text(),
    status: text().default('active').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_goals_user').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'goals_user_id_fkey',
    }).onDelete('cascade'),
    check(
      'goals_status_check',
      sql`status = ANY (ARRAY['active'::text, 'done'::text])`,
    ),
  ],
);

export const mistakePatterns = pgTable(
  'mistake_patterns',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    category: text().notNull(),
    description: text(),
    frequency: integer().default(0).notNull(),
    lastSeenAt: timestamp('last_seen_at', {
      withTimezone: true,
      mode: 'string',
    }),
    theoryLinkId: uuid('theory_link_id'),
  },
  (table) => [
    index('idx_patterns_user_freq').using(
      'btree',
      table.userId.asc().nullsLast().op('int4_ops'),
      table.frequency.desc().nullsFirst().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'mistake_patterns_user_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.theoryLinkId],
      foreignColumns: [theoryLinks.id],
      name: 'mistake_patterns_theory_link_id_fkey',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.category],
      foreignColumns: [mistakeCategories.code],
      name: 'fk_patterns_category',
    }),
    unique('mistake_patterns_user_id_category_key').on(
      table.userId,
      table.category,
    ),
    check('mistake_patterns_frequency_check', sql`frequency >= 0`),
  ],
);

export const theoryLinks = pgTable(
  'theory_links',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    category: text().notNull(),
    title: text().notNull(),
    url: text().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.category],
      foreignColumns: [mistakeCategories.code],
      name: 'fk_theory_links_category',
    }),
  ],
);

export const sessionReports = pgTable(
  'session_reports',
  {
    sessionId: uuid('session_id').primaryKey().notNull(),
    summary: text().notNull(),
    deepAnalysis: jsonb('deep_analysis'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    promptVersion: text('prompt_version'),
    model: text(),
  },
  (table) => [
    foreignKey({
      columns: [table.sessionId],
      foreignColumns: [sessions.id],
      name: 'session_reports_session_id_fkey',
    }).onDelete('cascade'),
  ],
);

export const hints = pgTable(
  'hints',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    sessionId: uuid('session_id').notNull(),
    utteranceId: uuid('utterance_id'),
    kind: text().notNull(),
    text: text().notNull(),
    wordId: uuid('word_id'),
  },
  (table) => [
    index('idx_hints_session').using(
      'btree',
      table.sessionId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.sessionId],
      foreignColumns: [sessions.id],
      name: 'hints_session_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.utteranceId],
      foreignColumns: [utterances.id],
      name: 'hints_utterance_id_fkey',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.wordId],
      foreignColumns: [words.id],
      name: 'hints_word_id_fkey',
    }).onDelete('set null'),
    check(
      'hints_kind_check',
      sql`kind = ANY (ARRAY['phrase_start'::text, 'translation'::text])`,
    ),
  ],
);

export const cards = pgTable(
  'cards',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    wordId: uuid('word_id').notNull(),
    front: text().notNull(),
    back: text().notNull(),
    dueAt: timestamp('due_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    intervalDays: integer('interval_days').default(1).notNull(),
  },
  (table) => [
    index('idx_cards_due').using(
      'btree',
      table.dueAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    foreignKey({
      columns: [table.wordId],
      foreignColumns: [words.id],
      name: 'cards_word_id_fkey',
    }).onDelete('cascade'),
    unique('cards_word_id_key').on(table.wordId),
    check('cards_interval_days_check', sql`interval_days > 0`),
  ],
);

export const exercises = pgTable(
  'exercises',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    cardId: uuid('card_id').notNull(),
    kind: text().default('fill_blank').notNull(),
    prompt: text().notNull(),
    expected: text().notNull(),
    answer: text(),
    isCorrect: boolean('is_correct'),
    answeredAt: timestamp('answered_at', {
      withTimezone: true,
      mode: 'string',
    }),
  },
  (table) => [
    index('idx_exercises_card').using(
      'btree',
      table.cardId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.cardId],
      foreignColumns: [cards.id],
      name: 'exercises_card_id_fkey',
    }).onDelete('cascade'),
    check('exercises_kind_check', sql`kind = 'fill_blank'::text`),
  ],
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_refresh_tokens_user').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'refresh_tokens_user_id_fkey',
    }).onDelete('cascade'),
    unique('refresh_tokens_token_hash_key').on(table.tokenHash),
  ],
);

export const utterances = pgTable(
  'utterances',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    sessionId: uuid('session_id').notNull(),
    seq: integer().notNull(),
    role: text().notNull(),
    textVerbatim: text('text_verbatim').notNull(),
    textClean: text('text_clean'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    analysisStatus: text('analysis_status').default('pending').notNull(),
    analysisPromptVersion: text('analysis_prompt_version'),
    analysisModel: text('analysis_model'),
    analyzedAt: timestamp('analyzed_at', {
      withTimezone: true,
      mode: 'string',
    }),
    betterPhrasings: jsonb('better_phrasings').default([]).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.sessionId],
      foreignColumns: [sessions.id],
      name: 'utterances_session_id_fkey',
    }).onDelete('cascade'),
    unique('utterances_session_id_seq_key').on(table.sessionId, table.seq),
    check(
      'utterances_role_check',
      sql`role = ANY (ARRAY['assistant'::text, 'user'::text])`,
    ),
    check(
      'utterances_analysis_status_check',
      sql`analysis_status = ANY (ARRAY['pending'::text, 'done'::text, 'failed'::text, 'skipped'::text])`,
    ),
    check(
      'utterances_better_phrasings_check',
      sql`jsonb_typeof(better_phrasings) = 'array'::text`,
    ),
  ],
);

export const mistakeCategories = pgTable('mistake_categories', {
  code: text().primaryKey().notNull(),
  titleUk: text('title_uk').notNull(),
  titleEn: text('title_en').notNull(),
});

export const mistakes = pgTable(
  'mistakes',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    utteranceId: uuid('utterance_id').notNull(),
    patternId: uuid('pattern_id'),
    original: text().notNull(),
    suggestion: text(),
    explanationEn: text('explanation_en'),
    translationUk: text('translation_uk'),
    startPos: integer('start_pos'),
    endPos: integer('end_pos'),
    isFalse: boolean('is_false').default(false).notNull(),
    category: text().notNull(),
  },
  (table) => [
    index('idx_mistakes_utterance').using(
      'btree',
      table.utteranceId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.utteranceId],
      foreignColumns: [utterances.id],
      name: 'mistakes_utterance_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.patternId],
      foreignColumns: [mistakePatterns.id],
      name: 'mistakes_pattern_id_fkey',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.category],
      foreignColumns: [mistakeCategories.code],
      name: 'mistakes_category_fkey',
    }),
    check(
      'chk_mistakes_span',
      sql`(start_pos IS NULL) OR (end_pos IS NULL) OR ((start_pos >= 0) AND (end_pos > start_pos))`,
    ),
  ],
);

export const profiles = pgTable(
  'profiles',
  {
    userId: uuid('user_id').primaryKey().notNull(),
    level: text().notNull(),
    scenes: text().array().default(['']).notNull(),
    interfaceLang: text('interface_lang').default('uk').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'profiles_user_id_fkey',
    }).onDelete('cascade'),
    check(
      'profiles_level_check',
      sql`level = ANY (ARRAY['A2'::text, 'B1'::text, 'B2'::text, 'C1'::text])`,
    ),
    check(
      'chk_profiles_interface_lang',
      sql`interface_lang = ANY (ARRAY['uk'::text, 'en'::text])`,
    ),
  ],
);

export const words = pgTable(
  'words',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    lemma: text().notNull(),
    translationUk: text('translation_uk'),
    state: text().default('new').notNull(),
    source: text().default('session').notNull(),
    timesUsed: integer('times_used').default(0).notNull(),
    lastUsedAt: timestamp('last_used_at', {
      withTimezone: true,
      mode: 'string',
    }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_words_user_created').using(
      'btree',
      table.userId.asc().nullsLast().op('timestamptz_ops'),
      table.createdAt.desc().nullsFirst().op('uuid_ops'),
      table.id.desc().nullsFirst().op('timestamptz_ops'),
    ),
    index('idx_words_user_state').using(
      'btree',
      table.userId.asc().nullsLast().op('text_ops'),
      table.state.asc().nullsLast().op('text_ops'),
    ),
    uniqueIndex('uq_words_user_lemma').using(
      'btree',
      sql`user_id`,
      sql`lower(lemma)`,
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'words_user_id_fkey',
    }).onDelete('cascade'),
    check(
      'words_source_check',
      sql`source = ANY (ARRAY['hint'::text, 'session'::text, 'user'::text])`,
    ),
    check('chk_words_times_used', sql`times_used >= 0`),
    check(
      'words_state_check',
      sql`state = ANY (ARRAY['new'::text, 'partial'::text, 'passive'::text, 'active'::text])`,
    ),
  ],
);

export const sessionWords = pgTable(
  'session_words',
  {
    sessionId: uuid('session_id').notNull(),
    wordId: uuid('word_id').notNull(),
  },
  (table) => [
    index('idx_session_words_word').using(
      'btree',
      table.wordId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.sessionId],
      foreignColumns: [sessions.id],
      name: 'session_words_session_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.wordId],
      foreignColumns: [words.id],
      name: 'session_words_word_id_fkey',
    }).onDelete('cascade'),
    primaryKey({
      columns: [table.sessionId, table.wordId],
      name: 'session_words_pkey',
    }),
  ],
);
