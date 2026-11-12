import { z } from 'zod';

/** Коди таблиці mistake_categories (db/migrations/0002_mvp_adjustments.sql). */
export const MISTAKE_CATEGORY_CODES = [
  'articles',
  'verb_tense',
  'subject_verb_agreement',
  'missing_be',
  'prepositions',
  'word_order',
  'question_form',
  'plural_countable',
  'conditionals',
  'collocation',
  'word_choice',
  'l1_calque',
  'other',
] as const;

export const MistakeCategoryCodeSchema = z.enum(MISTAKE_CATEGORY_CODES);

export type MistakeCategoryCode = z.infer<typeof MistakeCategoryCodeSchema>;
