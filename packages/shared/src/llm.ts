import { z } from 'zod';
import { MistakeCategoryCodeSchema } from './mistake-categories.js';
import { PLAN_QUESTIONS, QuestionSchema, TopicSchema } from './plan-bounds.js';

export const TranscriptSchema = z.object({
  /** Mistake positions are offsets in this text. */
  verbatim: z.string(),
  clean: z.string(),
  words: z
    .array(
      z.object({
        word: z.string(),
        start: z.number().nonnegative(),
        end: z.number().nonnegative(),
        confidence: z.number().min(0).max(1).optional(),
      }),
    )
    .optional(),
});

export type Transcript = z.infer<typeof TranscriptSchema>;

export const MISTAKE_TEXT_MAX = 200;

export const MISTAKE_EXPLANATION_MAX = 500;

export const ANALYSIS_MAX_MISTAKES = 30;

export const ANALYSIS_MAX_BETTER = 5;

/**
 * Positions are 0-based UTF-16 code unit offsets in text_verbatim, `end` is exclusive, and
 * `text.slice(start, end) === original` on api and web. Model positions are only a hint: the server aligns them.
 */
export const MistakeSchema = z
  .object({
    start: z.int().nonnegative(),
    end: z.int().nonnegative(),
    original: z.string().min(1).max(MISTAKE_TEXT_MAX),
    suggestion: z.string().max(MISTAKE_TEXT_MAX),
    category: MistakeCategoryCodeSchema,
    explanation_en: z.string().min(1).max(MISTAKE_EXPLANATION_MAX),
    translation_uk: z.string().min(1).max(MISTAKE_EXPLANATION_MAX),
  })
  .refine((m) => m.end > m.start, {
    error: 'end must be greater than start',
    path: ['end'],
  });

export type Mistake = z.infer<typeof MistakeSchema>;

export const BetterPhrasingSchema = z.object({
  original: z.string().min(1).max(MISTAKE_TEXT_MAX),
  better: z.string().min(1).max(MISTAKE_TEXT_MAX),
});

export type BetterPhrasing = z.infer<typeof BetterPhrasingSchema>;

/** Shape-only envelope: the server validates each item separately and drops the invalid ones. */
export const AnalysisEnvelopeSchema = z.object({
  mistakes: z.array(z.unknown()).max(ANALYSIS_MAX_MISTAKES),
  better: z.array(z.unknown()).max(ANALYSIS_MAX_BETTER),
});

export type AnalysisEnvelope = z.infer<typeof AnalysisEnvelopeSchema>;

export const PlanSchema = z.object({
  topic: TopicSchema,
  questions: z.array(QuestionSchema).length(PLAN_QUESTIONS),
});

export type Plan = z.infer<typeof PlanSchema>;

export const TurnSchema = z.object({
  question: QuestionSchema,
});

export type Turn = z.infer<typeof TurnSchema>;

/** For an unknown word, `word` is null and `message` is set. */
export const HintSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('phrase_start'), text: z.string().min(1) }),
  z.object({
    kind: z.literal('translation'),
    word: z.string().min(1).nullable(),
    message: z.string().optional(),
  }),
]);

export type Hint = z.infer<typeof HintSchema>;

export const SummarySchema = z.object({
  summary: z.string().min(1),
  top_categories: z.array(MistakeCategoryCodeSchema).max(3),
});

export type Summary = z.infer<typeof SummarySchema>;
