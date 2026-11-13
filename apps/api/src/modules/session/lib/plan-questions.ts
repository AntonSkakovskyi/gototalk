import { z } from 'zod';

const StoredPlanSchema = z.object({ questions: z.array(z.string()) });

export function parsePlanQuestions(plan: unknown): string[] {
  const parsed = StoredPlanSchema.safeParse(plan);
  return parsed.success ? parsed.data.questions : [];
}

function normalise(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

// A plan question counts as asked once an assistant utterance has the same text ignoring case and whitespace
export function remainingQuestions(
  planQuestions: string[],
  askedTexts: string[],
): string[] {
  const asked = new Set(askedTexts.map(normalise));
  return planQuestions.filter((question) => !asked.has(normalise(question)));
}
