import { z } from 'zod';
import { MistakeCategoryCodeSchema } from './mistake-categories.js';

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

/** Offsets in text_verbatim: 0-based, `end` is exclusive (`text.slice(start, end) === original`). */
export const MistakeSchema = z
  .object({
    start: z.int().nonnegative(),
    end: z.int().nonnegative(),
    original: z.string().min(1),
    suggestion: z.string(),
    category: MistakeCategoryCodeSchema,
    explanation_en: z.string().min(1),
    translation_uk: z.string().min(1),
  })
  .refine((m) => m.end > m.start, {
    error: 'end must be greater than start',
    path: ['end'],
  });

export type Mistake = z.infer<typeof MistakeSchema>;

export const BetterPhrasingSchema = z.object({
  original: z.string().min(1),
  better: z.string().min(1),
});

export type BetterPhrasing = z.infer<typeof BetterPhrasingSchema>;

export const AnalysisResultSchema = z.object({
  mistakes: z.array(MistakeSchema),
  better: z.array(BetterPhrasingSchema).max(2),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export const PlanSchema = z.object({
  topic: z.string().min(1),
  questions: z.array(z.string().min(1)).length(5),
});

export type Plan = z.infer<typeof PlanSchema>;

export const TurnSchema = z.object({
  question: z.string().min(1),
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
