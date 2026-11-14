import type { MistakeCategoryCode, WordState } from '@gototalk/shared';

export interface WeakArea {
  category: MistakeCategoryCode;
  frequency: number;
  lastSeenAt: Date | null;
}

export type VocabularyStats = Record<WordState, number>;

export interface LearnerModelSnapshot {
  weakAreas: WeakArea[];
  vocabulary: VocabularyStats;
}
