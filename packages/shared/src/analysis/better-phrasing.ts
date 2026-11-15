import { z } from 'zod';

const BETTER_PHRASING_TEXT_MAX = 200;

export const BetterPhrasingSchema = z.object({
  original: z.string().min(1).max(BETTER_PHRASING_TEXT_MAX),
  better: z.string().min(1).max(BETTER_PHRASING_TEXT_MAX),
});

export type BetterPhrasing = z.infer<typeof BetterPhrasingSchema>;
