import type { AnalysisResult, MistakeCategoryCode } from '@gototalk/shared';

export const WORD_STATES = ['new', 'partial', 'passive', 'active'] as const;

export type WordState = (typeof WORD_STATES)[number];

export interface WeakArea {
  category: MistakeCategoryCode;
  frequency: number;
  lastSeenAt: Date | null;
}

export type VocabularyStats = Record<WordState, number>;

export interface ApplyAnalysisInput {
  userId: string;
  utteranceId: string;
  /** text_clean of the utterance: vocabulary words found in it become active. */
  textClean: string;
  analysis: AnalysisResult;
}
