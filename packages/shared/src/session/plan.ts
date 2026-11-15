import { z } from 'zod';

export const TOPIC_MAX = 120;

export const QUESTION_MAX = 300;

export const PLAN_QUESTIONS = 5;

export const TopicSchema = z.string().trim().min(1).max(TOPIC_MAX);

export const QuestionSchema = z.string().trim().min(1).max(QUESTION_MAX);

export const PlanSchema = z.object({
  topic: TopicSchema,
  questions: z.array(QuestionSchema).length(PLAN_QUESTIONS),
});

export type Plan = z.infer<typeof PlanSchema>;
