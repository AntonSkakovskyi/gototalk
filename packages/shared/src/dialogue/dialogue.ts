import { z } from 'zod';
import { UtteranceSchema } from '../session/session.js';

export const ANSWER_TEXT_MAX = 1000;

export const AnswerTextRequestSchema = z.object({
  text: z.string().trim().min(1).max(ANSWER_TEXT_MAX),
});

export const TurnResultSchema = z.object({
  utterance: UtteranceSchema,
  reply: UtteranceSchema.nullable(),
  planRemaining: z.int().nonnegative(),
});

export const MarkMistakeRequestSchema = z.object({
  isFalse: z.literal(true),
});

export type AnswerTextRequest = z.infer<typeof AnswerTextRequestSchema>;
export type TurnResult = z.infer<typeof TurnResultSchema>;
export type MarkMistakeRequest = z.infer<typeof MarkMistakeRequestSchema>;
