import { describe, expect, it } from 'vitest';
import { parsePlanQuestions, remainingQuestions } from './plan-questions.js';

describe('parsePlanQuestions', () => {
  it('[TC-04-01] returns the stored questions', () => {
    expect(parsePlanQuestions({ questions: ['a', 'b'] })).toEqual(['a', 'b']);
  });

  it.each([null, undefined, {}, { questions: 'a' }, { questions: [1] }, 'x'])(
    '[TC-04-01] returns no questions for an invalid plan %j',
    (plan) => {
      expect(parsePlanQuestions(plan)).toEqual([]);
    },
  );
});

describe('remainingQuestions', () => {
  it('[TC-04-01] keeps the plan order and drops asked questions by exact text', () => {
    expect(remainingQuestions(['a', 'b', 'c'], ['b'])).toEqual(['a', 'c']);
  });

  it('[TC-04-01] treats a different text as not asked', () => {
    expect(remainingQuestions(['Tell me more.'], ['tell me more.'])).toEqual([
      'Tell me more.',
    ]);
  });

  it('[TC-04-01] collapses plan duplicates together', () => {
    expect(remainingQuestions(['a', 'a', 'b'], ['a'])).toEqual(['b']);
    expect(remainingQuestions(['a', 'a'], [])).toEqual(['a', 'a']);
  });

  it('[TC-04-01] returns nothing when every question was asked', () => {
    expect(remainingQuestions(['a'], ['a', 'x'])).toEqual([]);
  });
});
