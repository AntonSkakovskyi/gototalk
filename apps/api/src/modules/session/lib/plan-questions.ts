import { z } from 'zod';

const StoredPlanSchema = z.object({ questions: z.array(z.string()) });

export function parsePlanQuestions(plan: unknown): string[] {
  const parsed = StoredPlanSchema.safeParse(plan);
  return parsed.success ? parsed.data.questions : [];
}

// A plan question counts as asked once its exact text is an assistant utterance
export function remainingQuestions(
  planQuestions: string[],
  askedTexts: string[],
): string[] {
  const asked = new Set(askedTexts);
  return planQuestions.filter((question) => !asked.has(question));
}
