import { z } from 'zod';

export const HINT_WORD_MAX = 60;
export const HINT_PHRASE_MAX = 200;
/** Plausible English lemma: letters, spaces, apostrophes and hyphens. */
export const HINT_LEMMA_PATTERN = /^[A-Za-z][A-Za-z' -]*$/;

export const HintTranslationRequestSchema = z.object({
  kind: z.literal('translation'),
  word: z.string().trim().min(1).max(HINT_WORD_MAX),
});

export const HintRequestSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('phrase_start') }),
  HintTranslationRequestSchema,
]);

/** For an unknown word, `word` is null. */
export const HintResultSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('phrase_start'), text: z.string().min(1) }),
  z.object({
    kind: z.literal('translation'),
    word: z.string().min(1).nullable(),
  }),
]);

export type HintRequest = z.infer<typeof HintRequestSchema>;
export type HintResult = z.infer<typeof HintResultSchema>;
