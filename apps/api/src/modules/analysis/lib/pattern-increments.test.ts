import { describe, expect, it } from 'vitest';
import { patternIncrements } from './pattern-increments.js';

describe('patternIncrements', () => {
  it('[TC-04-01] counts one increment per mistake grouped by category', () => {
    expect(
      patternIncrements([
        { category: 'verb_tense' },
        { category: 'word_order' },
        { category: 'verb_tense' },
      ]),
    ).toEqual([
      { category: 'verb_tense', count: 2 },
      { category: 'word_order', count: 1 },
    ]);
  });

  it('[TC-04-01] keeps categories in first-seen order', () => {
    expect(
      patternIncrements([
        { category: 'word_order' },
        { category: 'verb_tense' },
        { category: 'word_order' },
      ]).map((p) => p.category),
    ).toEqual(['word_order', 'verb_tense']);
  });

  it('[TC-04-01] returns an empty list for no mistakes', () => {
    expect(patternIncrements([])).toEqual([]);
  });
});
