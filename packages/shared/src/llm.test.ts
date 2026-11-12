import { describe, expect, it } from 'vitest';
import {
  AnalysisResultSchema,
  HintSchema,
  MistakeSchema,
  PlanSchema,
  SummarySchema,
  TranscriptSchema,
  TurnSchema,
} from './index.js';

const mistake = {
  start: 0,
  end: 6,
  original: 'I go',
  suggestion: 'I went',
  category: 'verb_tense',
  explanation_en: 'Use the past simple.',
  translation_uk: 'Використовуйте Past Simple.',
};

describe('LLM/STT result schemas', () => {
  it('[TC-00-05] MistakeSchema приймає коректну помилку', () => {
    expect(MistakeSchema.parse(mistake)).toEqual(mistake);
  });

  it('[TC-00-05] MistakeSchema відхиляє невідому категорію й end <= start', () => {
    expect(
      MistakeSchema.safeParse({ ...mistake, category: 'spelling' }).success,
    ).toBe(false);
    expect(MistakeSchema.safeParse({ ...mistake, end: 0 }).success).toBe(false);
    expect(MistakeSchema.safeParse({ ...mistake, start: -1 }).success).toBe(
      false,
    );
  });

  it('[TC-00-05] AnalysisResultSchema: помилки й кращі формулювання', () => {
    const value = {
      mistakes: [mistake],
      better: [{ original: 'I go', better: 'I went' }],
    };
    expect(AnalysisResultSchema.parse(value)).toEqual(value);
    expect(AnalysisResultSchema.safeParse({ mistakes: [] }).success).toBe(
      false,
    );
  });

  it('[TC-00-05] TranscriptSchema, PlanSchema, TurnSchema, HintSchema, SummarySchema', () => {
    expect(
      TranscriptSchema.parse({ verbatim: 'Um, hi.', clean: 'Hi.' }),
    ).toEqual({ verbatim: 'Um, hi.', clean: 'Hi.' });
    expect(
      PlanSchema.safeParse({ topic: 'T', questions: ['a', 'b'] }).success,
    ).toBe(false);
    expect(
      PlanSchema.parse({ topic: 'T', questions: ['1', '2', '3', '4', '5'] })
        .questions,
    ).toHaveLength(5);
    expect(TurnSchema.parse({ question: 'Why?' })).toEqual({
      question: 'Why?',
    });
    expect(
      HintSchema.parse({ kind: 'phrase_start', text: 'I think…' }),
    ).toEqual({ kind: 'phrase_start', text: 'I think…' });
    expect(
      HintSchema.parse({ kind: 'translation', word: null, message: 'x' }),
    ).toEqual({ kind: 'translation', word: null, message: 'x' });
    expect(SummarySchema.parse({ summary: 'Ok', top_categories: [] })).toEqual({
      summary: 'Ok',
      top_categories: [],
    });
  });
});
