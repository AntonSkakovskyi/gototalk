import { describe, expect, it } from 'vitest';
import {
  MARKABLE_WORD_STATES,
  MarkWordRequestSchema,
  WORD_SOURCES,
  WORD_STATES,
  WordPageSchema,
  WordSchema,
  WordStateSchema,
} from '../index.js';

const word = {
  id: '0b1d3f0e-6f55-4a53-9c43-3a6a6a1c2d10',
  lemma: 'meeting',
  translationUk: 'зустріч',
  state: 'new',
  source: 'hint',
};

describe('word schemas', () => {
  it('[TC-05-05] the state, source and markable lists are fixed', () => {
    expect(WORD_STATES).toEqual(['new', 'partial', 'passive', 'active']);
    expect(WORD_SOURCES).toEqual(['hint', 'session', 'user']);
    expect(MARKABLE_WORD_STATES).toEqual(['new', 'partial', 'passive']);
    expect(WordStateSchema.safeParse('known').success).toBe(false);
  });

  it('[TC-05-05] WordSchema accepts a word with and without a translation', () => {
    expect(WordSchema.parse(word)).toEqual(word);
    expect(WordSchema.safeParse({ ...word, translationUk: null }).success).toBe(
      true,
    );
  });

  it('[TC-05-05] WordSchema rejects a bad id, state or source and a missing translation key', () => {
    expect(WordSchema.safeParse({ ...word, id: 'x' }).success).toBe(false);
    expect(WordSchema.safeParse({ ...word, state: 'known' }).success).toBe(
      false,
    );
    expect(WordSchema.safeParse({ ...word, source: 'import' }).success).toBe(
      false,
    );
    expect(
      WordSchema.safeParse({ ...word, translationUk: undefined }).success,
    ).toBe(false);
  });

  it.each(MARKABLE_WORD_STATES)(
    '[TC-05-05] MarkWordRequestSchema accepts %s',
    (state) => {
      expect(MarkWordRequestSchema.parse({ state })).toEqual({ state });
    },
  );

  it('[TC-05-05] MarkWordRequestSchema rejects active, an unknown state and a missing state', () => {
    expect(MarkWordRequestSchema.safeParse({ state: 'active' }).success).toBe(
      false,
    );
    expect(MarkWordRequestSchema.safeParse({ state: 'known' }).success).toBe(
      false,
    );
    expect(MarkWordRequestSchema.safeParse({}).success).toBe(false);
  });

  it('[TC-05-05] WordPageSchema takes a nullable cursor and rejects an invalid item', () => {
    expect(WordPageSchema.parse({ items: [word], nextCursor: null })).toEqual({
      items: [word],
      nextCursor: null,
    });
    expect(
      WordPageSchema.safeParse({ items: [], nextCursor: 'abc' }).success,
    ).toBe(true);
    expect(
      WordPageSchema.safeParse({
        items: [{ ...word, id: 1 }],
        nextCursor: null,
      }).success,
    ).toBe(false);
    expect(WordPageSchema.safeParse({ items: [] }).success).toBe(false);
  });
});
