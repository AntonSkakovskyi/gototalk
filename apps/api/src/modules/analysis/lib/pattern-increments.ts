import type { Mistake, MistakeCategoryCode } from '@gototalk/shared';

export function patternIncrements(
  mistakes: Pick<Mistake, 'category'>[],
): { category: MistakeCategoryCode; count: number }[] {
  const counts = new Map<MistakeCategoryCode, number>();
  for (const { category } of mistakes) {
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return [...counts].map(([category, count]) => ({ category, count }));
}
