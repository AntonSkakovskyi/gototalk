import { z } from 'zod';

export const WORD_STATES = ['new', 'partial', 'passive', 'active'] as const;

export const WordStateSchema = z.enum(WORD_STATES);

export const WORD_SOURCES = ['hint', 'session', 'user'] as const;

export const WordSourceSchema = z.enum(WORD_SOURCES);

export const MARKABLE_WORD_STATES = ['new', 'partial', 'passive'] as const;

export const WordSchema = z.object({
  id: z.uuid(),
  lemma: z.string(),
  translationUk: z.string().nullable(),
  state: WordStateSchema,
  source: WordSourceSchema,
});

export const MarkWordRequestSchema = z.object({
  state: z.enum(MARKABLE_WORD_STATES),
});

export const WordPageSchema = z.object({
  items: z.array(WordSchema),
  nextCursor: z.string().nullable(),
});

export type WordState = z.infer<typeof WordStateSchema>;
export type WordSource = z.infer<typeof WordSourceSchema>;
export type Word = z.infer<typeof WordSchema>;
export type MarkWordRequest = z.infer<typeof MarkWordRequestSchema>;
export type WordPage = z.infer<typeof WordPageSchema>;
