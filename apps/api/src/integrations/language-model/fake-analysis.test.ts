import {
  AnalysisEnvelopeSchema,
  ANALYSIS_MAX_MISTAKES,
} from '@gototalk/shared';
import { AnalysisResultSchema } from '../testing/analysis-result-schema.js';
import { describe, expect, it } from 'vitest';
import { analyzeText } from './fake-analysis.js';

describe('analyzeText', () => {
  it('[TC-04-01] matches case-insensitively and keeps the original as typed', () => {
    const { mistakes } = analyzeText('YESTERDAY i GO there. WHY YOU THINK so?');

    expect(mistakes.map((m) => m.original)).toEqual([
      'YESTERDAY i GO',
      'WHY YOU THINK',
    ]);
  });

  it('[TC-04-01] returns several rules in one text sorted by start', () => {
    const { mistakes } = analyzeText(
      'I very like it. Since 2 years I am agree. She busy.',
    );

    expect(mistakes.map((m) => m.category)).toEqual([
      'word_order',
      'prepositions',
      'l1_calque',
      'missing_be',
    ]);
    const starts = mistakes.map((m) => m.start);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });

  it('[TC-04-01] drops a match that overlaps an earlier accepted one', () => {
    const { mistakes } = analyzeText('She make a photo of it.');

    expect(mistakes).toHaveLength(1);
    expect(mistakes[0]).toMatchObject({
      original: 'She make',
      suggestion: 'She makes',
      category: 'subject_verb_agreement',
    });
  });

  it('[TC-04-01] gives empty results when nothing matches', () => {
    expect(analyzeText('Hello there.')).toEqual({ mistakes: [], better: [] });
    expect(analyzeText('')).toEqual({ mistakes: [], better: [] });
  });

  it('[TC-04-01] is deterministic on repeated calls', () => {
    const text = 'Yesterday I go home. I very like it.';

    expect(analyzeText(text)).toEqual(analyzeText(text));
  });

  it('[TC-04-01] builds up to 2 better phrasings from sentences with mistakes', () => {
    const { better } = analyzeText(
      'Yesterday I go home. It was nice. I very like my job. She busy.',
    );

    expect(better).toEqual([
      { original: 'Yesterday I go home.', better: 'Yesterday I went home.' },
      { original: 'I very like my job.', better: 'I really like my job.' },
    ]);
  });

  it('[TC-04-01] applies several suggestions inside one sentence', () => {
    const { better } = analyzeText(
      'I am agree that she busy, but I very like it.',
    );

    expect(better).toEqual([
      {
        original: 'I am agree that she busy, but I very like it.',
        better: 'I agree that she is busy, but I really like it.',
      },
    ]);
  });

  it('[TC-04-01] skips sentences longer than 200 characters in better', () => {
    const { mistakes, better } = analyzeText(
      `${'word '.repeat(45)}I very like it.`,
    );

    expect(mistakes).toHaveLength(1);
    expect(better).toEqual([]);
  });

  it('[TC-04-01] the whole output passes the schemas with better at most 2', () => {
    const result = analyzeText(
      'I am agree. She work. Yesterday I go. I very like it. It depends of me.',
    );

    expect(AnalysisEnvelopeSchema.safeParse(result).success).toBe(true);
    expect(AnalysisResultSchema.safeParse(result).success).toBe(true);
    expect(result.better.length).toBeLessThanOrEqual(2);
  });

  it.each([['he go '.repeat(166)], ['if I will '.repeat(100)]])(
    '[TC-04-01] a 1000-character answer is capped at the schema limits',
    (text) => {
      const result = analyzeText(text);

      expect(result.mistakes).toHaveLength(ANALYSIS_MAX_MISTAKES);
      expect(result.better.length).toBeLessThanOrEqual(2);
      expect(AnalysisEnvelopeSchema.safeParse(result).success).toBe(true);
    },
  );
});
