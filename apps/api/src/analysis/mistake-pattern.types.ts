import type { Mistake, MistakeCategoryCode } from '@gototalk/shared';

/** Помилки однієї категорії, згруповані в патерн. */
export interface PatternGroup {
  category: MistakeCategoryCode;
  /** Кількість помилок у групі: на стільки зростає `mistake_patterns.frequency`. */
  frequency: number;
  mistakes: Mistake[];
}
