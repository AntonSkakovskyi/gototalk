import { z } from 'zod';
import { MistakeCategoryCodeSchema } from './mistake-categories.js';

export const ANALYSIS_STATUSES = [
  'pending',
  'done',
  'failed',
  'skipped',
] as const;

export const AnalysisStatusSchema = z.enum(ANALYSIS_STATUSES);

/** Offsets in the utterance text (text_verbatim): UTF-16 code units, `end` exclusive. */
export const MistakeViewSchema = z
  .object({
    id: z.uuid(),
    start: z.int().nonnegative(),
    end: z.int().nonnegative(),
    original: z.string().min(1),
    suggestion: z.string(),
    category: MistakeCategoryCodeSchema,
    explanationEn: z.string(),
    translationUk: z.string(),
    isFalse: z.boolean(),
  })
  .refine((m) => m.end > m.start, {
    error: 'end must be greater than start',
    path: ['end'],
  });

export type AnalysisStatus = z.infer<typeof AnalysisStatusSchema>;
export type MistakeView = z.infer<typeof MistakeViewSchema>;
