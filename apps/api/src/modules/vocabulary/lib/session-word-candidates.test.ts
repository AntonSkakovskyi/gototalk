import { describe, expect, it } from 'vitest';
import { FUNCTION_WORDS } from './function-words.js';
import { sessionWordCandidates } from './session-word-candidates.js';

describe('sessionWordCandidates', () => {
  it('[TC-05-01] returns only the tokens that are new in the better phrasing', () => {
    expect(
      sessionWordCandidates([
        { original: 'yesterday I go', better: 'yesterday I went' },
      ]),
    ).toEqual(['went']);
    expect(
      sessionWordCandidates([
        { original: 'I very like my job', better: 'I really like my job' },
      ]),
    ).toEqual(['really']);
  });

  it('[TC-05-01] compares tokens case-insensitively and lower-cases the result', () => {
    expect(
      sessionWordCandidates([
        { original: 'Yesterday I go', better: 'yesterday I Went' },
      ]),
    ).toEqual(['went']);
  });

  it('[TC-05-01] dedupes across pairs and keeps the order of first appearance', () => {
    expect(
      sessionWordCandidates([
        { original: 'I go home', better: 'I went home early' },
        { original: 'we go', better: 'we Went there' },
        { original: 'he go', better: 'he went early' },
      ]),
    ).toEqual(['went', 'early']);
  });

  it('[TC-05-01] returns an empty list for no pairs or when nothing is new', () => {
    expect(sessionWordCandidates([])).toEqual([]);
    expect(
      sessionWordCandidates([{ original: 'big dog', better: 'dog big' }]),
    ).toEqual([]);
  });

  it('[TC-05-01] ignores purely numeric tokens', () => {
    expect(
      sessionWordCandidates([
        { original: 'I have apples', better: 'I have 12 apples and 3.5 pears' },
      ]),
    ).toEqual(['pears']);
  });

  it('[TC-05-01] treats curly and straight apostrophes as the same character', () => {
    expect(
      sessionWordCandidates([
        { original: 'my brother’s car', better: "my brother's car" },
      ]),
    ).toEqual([]);
    expect(
      sessionWordCandidates([
        { original: 'he loves', better: 'he’s fond of mum’s cooking' },
      ]),
    ).toEqual(['fond', "mum's", 'cooking']);
  });

  it('[TC-05-01] never returns function words', () => {
    expect(
      sessionWordCandidates([
        {
          original: 'work',
          better: "I don't think that it's the best way to do it, but I'd try",
        },
      ]),
    ).toEqual(['think', 'best', 'way', 'try']);
    expect(
      sessionWordCandidates([
        { original: 'x', better: [...FUNCTION_WORDS].join(' ') },
      ]),
    ).toEqual([]);
  });
});

describe('FUNCTION_WORDS', () => {
  it('[TC-05-01] is lower-case and alphabetically sorted, and keeps learnable adverbs', () => {
    const list = [...FUNCTION_WORDS];
    expect(list.every((word) => word === word.toLowerCase())).toBe(true);
    expect(list).toEqual([...list].sort());
    expect(FUNCTION_WORDS.has('really')).toBe(false);
    expect(FUNCTION_WORDS.has('very')).toBe(false);
  });
});
