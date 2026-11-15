import { z } from 'zod';

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
