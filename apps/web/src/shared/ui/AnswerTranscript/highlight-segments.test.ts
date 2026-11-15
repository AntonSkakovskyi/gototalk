import { testMistake } from '@/shared/testing/fixtures/session';
import { buildSegments, type Segment } from './highlight-segments';

const TEXT = 'I go to the offsite yesterday';
const GO = testMistake({ start: 2, end: 4, original: 'go' });
const YESTERDAY = testMistake({
  id: '3f6b2d18-9c4e-4a7b-b2d0-5e8a1c7f0002',
  start: 20,
  end: 29,
  original: 'yesterday',
  suggestion: 'the day before',
});

function reassemble(segments: Segment[]): string {
  return segments.map((segment) => segment.text).join('');
}

function mistakeTexts(segments: Segment[]): string[] {
  return segments.flatMap((segment) =>
    segment.kind === 'mistake' ? [segment.text] : [],
  );
}

describe('buildSegments', () => {
  it('[TC-04-04] returns the whole text as one plain segment without mistakes', () => {
    expect(buildSegments(TEXT, [])).toEqual([{ kind: 'text', text: TEXT }]);
  });

  it('[TC-04-04] splits the text around a mistake and reassembles it exactly', () => {
    const segments = buildSegments(TEXT, [GO]);

    expect(segments).toEqual([
      { kind: 'text', text: 'I ' },
      { kind: 'mistake', text: 'go', mistake: GO },
      { kind: 'text', text: ' to the offsite yesterday' },
    ]);
    expect(reassemble(segments)).toBe(TEXT);
  });

  it('[TC-04-04] sorts mistakes by start and omits empty text segments', () => {
    const first = testMistake({ start: 0, end: 1, original: 'I' });
    const segments = buildSegments(TEXT, [YESTERDAY, first]);

    expect(segments.map((segment) => segment.kind)).toEqual([
      'mistake',
      'text',
      'mistake',
    ]);
    expect(segments.at(-1)).toEqual({
      kind: 'mistake',
      text: 'yesterday',
      mistake: YESTERDAY,
    });
    expect(reassemble(segments)).toBe(TEXT);
  });

  it('[TC-04-04] does not highlight a mistake marked as false', () => {
    const segments = buildSegments(TEXT, [{ ...GO, isFalse: true }]);

    expect(mistakeTexts(segments)).toEqual([]);
    expect(reassemble(segments)).toBe(TEXT);
  });

  it.each([
    ['negative start', { start: -1, end: 2 }],
    ['empty range', { start: 4, end: 4 }],
    ['inverted range', { start: 4, end: 2 }],
    ['end beyond the text', { start: 20, end: 40 }],
  ])('[TC-04-04] skips a mistake with %s', (_name, range) => {
    const segments = buildSegments(TEXT, [{ ...GO, ...range }]);

    expect(mistakeTexts(segments)).toEqual([]);
    expect(reassemble(segments)).toBe(TEXT);
  });

  it('[TC-04-04] skips a mistake whose slice differs from the original', () => {
    const segments = buildSegments(TEXT, [{ ...GO, original: 'went' }]);

    expect(mistakeTexts(segments)).toEqual([]);
  });

  it('[TC-04-04] skips a mistake overlapping an earlier accepted one', () => {
    const overlapping = testMistake({
      id: '3f6b2d18-9c4e-4a7b-b2d0-5e8a1c7f0003',
      start: 3,
      end: 7,
      original: 'o to',
    });
    const segments = buildSegments(TEXT, [overlapping, GO]);

    expect(mistakeTexts(segments)).toEqual(['go']);
    expect(reassemble(segments)).toBe(TEXT);
  });

  it('[TC-04-04] keeps touching mistakes', () => {
    const next = testMistake({
      id: '3f6b2d18-9c4e-4a7b-b2d0-5e8a1c7f0004',
      start: 4,
      end: 7,
      original: ' to',
    });

    expect(mistakeTexts(buildSegments(TEXT, [GO, next]))).toEqual([
      'go',
      ' to',
    ]);
  });

  it('[TC-04-04] counts offsets in UTF-16 code units after an emoji and Cyrillic', () => {
    const text = 'Привіт 😀 I go there';
    const start = text.indexOf('go');
    const mistake = testMistake({ start, end: start + 2, original: 'go' });
    const segments = buildSegments(text, [mistake]);

    expect(start).toBe(12);
    expect(mistakeTexts(segments)).toEqual(['go']);
    expect(reassemble(segments)).toBe(text);
  });

  it('[TC-04-04] skips a range that cuts an emoji surrogate pair', () => {
    const text = 'a 😀 b';
    const mistake = testMistake({ start: 2, end: 3, original: '😀' });

    expect(mistakeTexts(buildSegments(text, [mistake]))).toEqual([]);
  });
});
