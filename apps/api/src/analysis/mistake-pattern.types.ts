import type { Mistake, MistakeCategoryCode } from '@gototalk/shared';

export interface PatternGroup {
  category: MistakeCategoryCode;
  /** How much mistake_patterns.frequency grows. */
  frequency: number;
  mistakes: Mistake[];
}
