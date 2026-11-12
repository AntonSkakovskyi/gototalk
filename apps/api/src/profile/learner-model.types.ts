import type { AnalysisResult, MistakeCategoryCode } from '@gototalk/shared';

/** Стани слова в `words.state`. */
export const WORD_STATES = ['new', 'partial', 'passive', 'active'] as const;

export type WordState = (typeof WORD_STATES)[number];

/** Патерн помилок учня за частотою (рядок `mistake_patterns`). */
export interface WeakArea {
  category: MistakeCategoryCode;
  frequency: number;
  lastSeenAt: Date | null;
}

/** Кількість слів учня за станами. */
export type VocabularyStats = Record<WordState, number>;

/** Вхід `applyAnalysis`: результат аналізу однієї репліки користувача. */
export interface ApplyAnalysisInput {
  userId: string;
  utteranceId: string;
  /** `text_clean` репліки: за ним слова зі словника переходять у `active`. */
  textClean: string;
  analysis: AnalysisResult;
}
