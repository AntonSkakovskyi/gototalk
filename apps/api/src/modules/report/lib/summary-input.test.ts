import type { MistakeCategoryCode } from '@gototalk/shared';
import { describe, expect, it } from 'vitest';
import { buildSummaryInput } from './summary-input.js';

const category = (category: MistakeCategoryCode, count: number) => ({
  category,
  titleUk: `title ${category}`,
  count,
});

const example = (original: string) => ({
  original,
  suggestion: `${original}!`,
});

describe('buildSummaryInput', () => {
  it('[TC-05-01] rounds the duration to minutes and keeps at least one', () => {
    expect(
      buildSummaryInput({ answers: 2, durationSeconds: 0 }, [], new Map())
        .minutes,
    ).toBe(1);
    expect(
      buildSummaryInput({ answers: 2, durationSeconds: 89 }, [], new Map())
        .minutes,
    ).toBe(1);
    expect(
      buildSummaryInput({ answers: 2, durationSeconds: 90 }, [], new Map())
        .minutes,
    ).toBe(2);
    expect(
      buildSummaryInput({ answers: 2, durationSeconds: 601 }, [], new Map())
        .minutes,
    ).toBe(10);
  });

  it('[TC-05-01] passes the answers count through', () => {
    expect(
      buildSummaryInput({ answers: 7, durationSeconds: 60 }, [], new Map())
        .answers,
    ).toBe(7);
  });

  it('[TC-05-01] keeps the top categories in order with title, count and examples', () => {
    const examples = new Map([['articles', [example('a'), example('b')]]]);

    const input = buildSummaryInput(
      { answers: 3, durationSeconds: 120 },
      [category('articles', 4), category('verb_tense', 2)],
      examples,
    );

    expect(input.categories).toEqual([
      {
        code: 'articles',
        title: 'title articles',
        count: 4,
        examples: [example('a'), example('b')],
      },
      { code: 'verb_tense', title: 'title verb_tense', count: 2, examples: [] },
    ]);
  });

  it('[TC-05-01] cuts the categories to the top three', () => {
    const input = buildSummaryInput(
      { answers: 3, durationSeconds: 120 },
      [
        category('articles', 5),
        category('verb_tense', 4),
        category('collocation', 3),
        category('other', 2),
      ],
      new Map(),
    );

    expect(input.categories.map((item) => item.code)).toEqual([
      'articles',
      'verb_tense',
      'collocation',
    ]);
  });

  it('[TC-05-01] allows at most two examples per category', () => {
    const examples = new Map([
      ['articles', [example('a'), example('b'), example('c')]],
    ]);

    const input = buildSummaryInput(
      { answers: 1, durationSeconds: 60 },
      [category('articles', 3)],
      examples,
    );

    expect(input.categories[0]?.examples).toEqual([example('a'), example('b')]);
  });
});
