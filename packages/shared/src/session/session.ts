import { z } from 'zod';
import {
  AnalysisStatusSchema,
  MistakeViewSchema,
} from '../analysis/analysis-view.js';
import { BetterPhrasingSchema } from '../analysis/better-phrasing.js';
import {
  PLAN_QUESTIONS,
  PlanSchema,
  QuestionSchema,
  TopicSchema,
} from './plan.js';

export const FEEDBACK_MODES = ['immediate', 'deferred'] as const;

export const FeedbackModeSchema = z.enum(FEEDBACK_MODES);

export const TOPIC_SOURCES = ['suggested', 'custom'] as const;

export const TopicSourceSchema = z.enum(TOPIC_SOURCES);

export const SESSION_STATUSES = ['active', 'finished'] as const;

export const SessionStatusSchema = z.enum(SESSION_STATUSES);

export const UTTERANCE_ROLES = ['assistant', 'user'] as const;

export const UtteranceRoleSchema = z.enum(UTTERANCE_ROLES);

export const MAX_TOPIC_REROLLS = 3;

export const RECENT_SESSIONS_LIMIT = 10;

export const PlanSessionRequestSchema = z.object({
  previousTopics: z.array(TopicSchema).max(MAX_TOPIC_REROLLS).default([]),
  customTopic: TopicSchema.optional(),
});

export const SessionPlanSchema = PlanSchema.extend({
  topicSource: TopicSourceSchema,
});

export const StartSessionRequestSchema = z.object({
  topic: TopicSchema,
  topicSource: TopicSourceSchema,
  questions: z.array(QuestionSchema).length(PLAN_QUESTIONS),
  feedbackMode: FeedbackModeSchema.default('immediate'),
});

export const SessionSchema = z.object({
  id: z.uuid(),
  topic: TopicSchema,
  topicSource: TopicSourceSchema,
  feedbackMode: FeedbackModeSchema,
  status: SessionStatusSchema,
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime().nullable(),
});

export const SessionListSchema = z.array(SessionSchema);

export const SessionPageSchema = z.object({
  items: z.array(SessionSchema),
  nextCursor: z.string().nullable(),
});

export const UtteranceSchema = z.object({
  id: z.uuid(),
  seq: z.int().positive(),
  role: UtteranceRoleSchema,
  /** text_verbatim: mistake positions are offsets in this text. */
  text: z.string(),
  analysisStatus: AnalysisStatusSchema,
  mistakes: z.array(MistakeViewSchema),
  better: z.array(BetterPhrasingSchema),
});

export const SessionDetailsSchema = SessionSchema.extend({
  utterances: z.array(UtteranceSchema),
  planRemaining: z.int().nonnegative(),
});

export type FeedbackMode = z.infer<typeof FeedbackModeSchema>;
export type TopicSource = z.infer<typeof TopicSourceSchema>;
export type SessionStatus = z.infer<typeof SessionStatusSchema>;
export type UtteranceRole = z.infer<typeof UtteranceRoleSchema>;
export type PlanSessionRequest = z.infer<typeof PlanSessionRequestSchema>;
export type SessionPlan = z.infer<typeof SessionPlanSchema>;
export type StartSessionRequest = z.infer<typeof StartSessionRequestSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type SessionPage = z.infer<typeof SessionPageSchema>;
export type Utterance = z.infer<typeof UtteranceSchema>;
export type SessionDetails = z.infer<typeof SessionDetailsSchema>;
