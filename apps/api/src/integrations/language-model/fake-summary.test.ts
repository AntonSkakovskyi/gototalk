import { REPORT_SUMMARY_MAX } from '@gototalk/shared';
import { SummarySchema } from './model-output.js';
import type { MistakeCategoryCode } from '@gototalk/shared';
import { describe, expect, it } from 'vitest';
import { buildSummary } from './fake-summary.js';
import type { SummarizeSessionInput } from './language-model.port.js';

const category = (
  title: string,
  code: MistakeCategoryCode = 'verb_tense',
): SummarizeSessionInput['categories'][number] => ({
  code,
  title,
  count: 1,
  examples: [{ original: 'I go', suggestion: 'I went' }],
});

describe('buildSummary', () => {
  it.each([
    [1, 'раз'],
    [2, 'рази'],
    [5, 'разів'],
    [11, 'разів'],
    [12, 'разів'],
    [21, 'раз'],
    [22, 'рази'],
    [25, 'разів'],
  ])('[TC-05-04] %i answers use the form «%s»', (answers, form) => {
    const { summary } = buildSummary({ answers, minutes: 3, categories: [] });

    expect(summary).toBe(
      `Ви відповіли ${answers} ${form} за 3 хв. Помилок не знайдено, так тримати.`,
    );
  });

  it('[TC-05-04] lists up to three categories and focuses on the first', () => {
    const { summary } = buildSummary({
      answers: 4,
      minutes: 7,
      categories: [
        category('Часи дієслів'),
        category('Артиклі', 'articles'),
        category('Прийменники', 'prepositions'),
        category('Порядок слів', 'word_order'),
      ],
    });

    expect(summary).toBe(
      'Ви відповіли 4 рази за 7 хв. Найчастіші помилки: Часи дієслів, Артиклі, Прийменники. Зосередьтеся на категорії «Часи дієслів» у наступній сесії.',
    );
  });

  it('[TC-05-04] uses the singular phrase for exactly one category', () => {
    const { summary } = buildSummary({
      answers: 1,
      minutes: 1,
      categories: [category('Часи дієслів')],
    });

    expect(summary).toBe(
      'Ви відповіли 1 раз за 1 хв. Найчастіша помилка: Часи дієслів. Зосередьтеся на категорії «Часи дієслів» у наступній сесії.',
    );
  });

  it('[TC-05-04] uses the comma list for exactly two categories', () => {
    const { summary } = buildSummary({
      answers: 2,
      minutes: 2,
      categories: [category('Артиклі', 'articles'), category('Часи дієслів')],
    });

    expect(summary).toContain('Найчастіші помилки: Артиклі, Часи дієслів.');
  });

  it('[TC-05-04] stays within the summary limit even with very long titles', () => {
    const long = 'Д'.repeat(400);
    const input: SummarizeSessionInput = {
      answers: 9,
      minutes: 9,
      categories: [category(long), category(long), category(long)],
    };

    const result = buildSummary(input);

    expect(result.summary.length).toBeLessThanOrEqual(REPORT_SUMMARY_MAX);
    expect(SummarySchema.safeParse(result).success).toBe(true);
  });

  it('[TC-05-04] is deterministic and passes SummarySchema', () => {
    const input: SummarizeSessionInput = {
      answers: 3,
      minutes: 5,
      categories: [category('Часи дієслів')],
    };

    expect(buildSummary(input)).toEqual(buildSummary(input));
    expect(SummarySchema.safeParse(buildSummary(input)).success).toBe(true);
  });
});
