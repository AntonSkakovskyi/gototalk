import { describe, expect, it } from 'vitest';
import { usageCandidates } from './word-usage.js';

describe('usageCandidates', () => {
  it('[TC-04-01] lowercases and splits on punctuation', () => {
    expect(usageCandidates('Hello, World!')).toEqual([
      'hello',
      'world',
      'hello world',
    ]);
  });

  it('[TC-04-01] keeps apostrophes and hyphens inside a token and normalises the curly apostrophe', () => {
    expect(usageCandidates('I don’t like it')).toContain("don't");
    expect(usageCandidates("It's a well-known fact")).toEqual(
      expect.arrayContaining(["it's", 'well-known', "it's a", 'a well-known']),
    );
  });

  it('[TC-04-01] does not treat edge quotes or dashes as part of a token', () => {
    expect(usageCandidates("'quoted' - word")).toEqual([
      'quoted',
      'word',
      'quoted word',
    ]);
  });

  it('[TC-04-01] builds n-grams of up to 4 tokens joined with a single space', () => {
    const result = usageCandidates('a b c d e');
    expect(result).toContain('a b c d');
    expect(result).toContain('b c d e');
    expect(result).not.toContain('a b c d e');
  });

  it('[TC-04-01] matches multi-word lemmas across extra whitespace and punctuation', () => {
    expect(usageCandidates('I will   be able, to go')).toContain('be able to');
  });

  it('[TC-04-01] deduplicates repeated words and phrases', () => {
    const result = usageCandidates('meeting meeting');
    expect(result.filter((c) => c === 'meeting')).toHaveLength(1);
    expect(new Set(result).size).toBe(result.length);
  });

  it('[TC-04-01] works on token boundaries, not substrings', () => {
    const result = usageCandidates('steam');
    expect(result).toEqual(['steam']);
    expect(result).not.toContain('team');
  });

  it('[TC-04-01] does not lemmatise', () => {
    const result = usageCandidates('meetings');
    expect(result).toContain('meetings');
    expect(result).not.toContain('meeting');
  });

  it('[TC-04-01] returns nothing for empty or punctuation-only text', () => {
    expect(usageCandidates('')).toEqual([]);
    expect(usageCandidates(' ... !? ')).toEqual([]);
  });

  it('[TC-04-01] keeps digits as tokens', () => {
    expect(usageCandidates('5 years')).toEqual(['5', 'years', '5 years']);
  });

  it('[TC-04-01] yields Cyrillic tokens harmlessly', () => {
    expect(usageCandidates('Привіт світ')).toEqual([
      'привіт',
      'світ',
      'привіт світ',
    ]);
  });
});
