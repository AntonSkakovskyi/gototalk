import type { Mistake } from '../../../integrations/language-model/model-output.js';
import { describe, expect, it } from 'vitest';
import { alignMistakes } from './align-mistakes.js';

function mistake(start: number, end: number, original: string): Mistake {
  return {
    start,
    end,
    original,
    suggestion: 'x',
    category: 'verb_tense',
    explanation_en: 'e',
    translation_uk: 'u',
  };
}

const positions = (items: Mistake[]) => items.map((m) => [m.start, m.end]);

describe('alignMistakes', () => {
  it('[TC-04-01] keeps a mistake whose slice matches original', () => {
    const text = 'Yesterday I go home';
    const input = [mistake(10, 14, 'I go')];

    expect(alignMistakes(text, input)).toEqual({ mistakes: input, dropped: 0 });
  });

  it('[TC-04-01] moves shifted positions to the exact occurrence', () => {
    const text = 'Yesterday I go home';

    const { mistakes, dropped } = alignMistakes(text, [mistake(3, 7, 'I go')]);

    expect(positions(mistakes)).toEqual([[10, 14]]);
    expect(text.slice(mistakes[0]?.start, mistakes[0]?.end)).toBe('I go');
    expect(dropped).toBe(0);
  });

  it('[TC-04-01] picks the occurrence nearest to the hinted start', () => {
    const text = 'go and go and go';

    const { mistakes } = alignMistakes(text, [mistake(9, 11, 'go')]);

    expect(positions(mistakes)).toEqual([[7, 9]]);
  });

  it('[TC-04-01] prefers the earlier occurrence on a tie', () => {
    const text = 'go xx go';

    const { mistakes } = alignMistakes(text, [mistake(3, 5, 'go')]);

    expect(positions(mistakes)).toEqual([[0, 2]]);
  });

  it('[TC-04-01] drops a mistake whose original is not in the text', () => {
    const result = alignMistakes('I went home', [mistake(0, 4, 'I go')]);

    expect(result).toEqual({ mistakes: [], dropped: 1 });
  });

  it('[TC-04-01] matches case-sensitively', () => {
    const result = alignMistakes('i go home', [mistake(0, 4, 'I go')]);

    expect(result).toEqual({ mistakes: [], dropped: 1 });
  });

  it('[TC-04-01] drops a mistake that overlaps an accepted one', () => {
    const text = 'I very like it';

    const { mistakes, dropped } = alignMistakes(text, [
      mistake(0, 11, 'I very like'),
      mistake(2, 6, 'very'),
    ]);

    expect(positions(mistakes)).toEqual([[0, 11]]);
    expect(dropped).toBe(1);
  });

  it('[TC-04-01] keeps adjacent mistakes that only touch', () => {
    const { mistakes, dropped } = alignMistakes('I go home', [
      mistake(0, 1, 'I'),
      mistake(1, 5, ' go '),
    ]);

    expect(positions(mistakes)).toEqual([
      [0, 1],
      [1, 5],
    ]);
    expect(dropped).toBe(0);
  });

  it('[TC-04-01] sorts unsorted input by start', () => {
    const text = 'I go home and she work';

    const { mistakes } = alignMistakes(text, [
      mistake(17, 25, 'she work'),
      mistake(0, 4, 'I go'),
    ]);

    expect(mistakes.map((m) => m.original)).toEqual(['I go', 'she work']);
  });

  it('[TC-04-01] counts offsets in UTF-16 code units after emoji and Cyrillic', () => {
    const text = 'Привіт 😀 I go home';
    const start = text.indexOf('I go');

    const { mistakes } = alignMistakes(text, [mistake(0, 4, 'I go')]);

    expect(start).toBe(10);
    expect([...text.slice(0, start)]).toHaveLength(9);
    expect(positions(mistakes)).toEqual([[10, 14]]);
  });

  it('[TC-04-01] handles an end beyond the text length', () => {
    const text = 'I go';

    const { mistakes } = alignMistakes(text, [mistake(0, 100, 'I go')]);

    expect(positions(mistakes)).toEqual([[0, 4]]);
  });

  it('[TC-04-01] returns an empty result for no mistakes', () => {
    expect(alignMistakes('I go', [])).toEqual({ mistakes: [], dropped: 0 });
  });
});
