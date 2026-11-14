import { testUtterance } from '@/shared/testing/test-fixtures';
import {
  answersWithQuestions,
  awaitingReply,
  currentQuestion,
  sortBySeq,
} from './turns';

describe('currentQuestion', () => {
  it('[TC-04-04] returns the last assistant utterance', () => {
    expect(
      currentQuestion([
        testUtterance({ id: 'a', seq: 1, role: 'assistant', text: 'First?' }),
        testUtterance({ id: 'b', seq: 2, role: 'user', text: 'My answer' }),
        testUtterance({ id: 'c', seq: 3, role: 'assistant', text: 'Second?' }),
      ])?.text,
    ).toBe('Second?');
  });

  it('[TC-04-04] ignores the order of the array and trusts seq', () => {
    expect(
      currentQuestion([
        testUtterance({ id: 'c', seq: 3, role: 'assistant', text: 'Second?' }),
        testUtterance({ id: 'a', seq: 1, role: 'assistant', text: 'First?' }),
      ])?.id,
    ).toBe('c');
  });

  it('[TC-04-04] does not take a trailing user utterance', () => {
    expect(
      currentQuestion([
        testUtterance({ id: 'a', seq: 1, role: 'assistant', text: 'First?' }),
        testUtterance({ id: 'b', seq: 2, role: 'user', text: 'My answer' }),
      ])?.text,
    ).toBe('First?');
  });

  it('[TC-04-04] returns undefined when the assistant has not spoken', () => {
    expect(currentQuestion([])).toBeUndefined();
  });
});

describe('sortBySeq', () => {
  it('[TC-04-04] orders by seq without mutating the input', () => {
    const input = [
      testUtterance({ id: 'b', seq: 2 }),
      testUtterance({ id: 'a', seq: 1 }),
    ];

    expect(sortBySeq(input).map((item) => item.id)).toEqual(['a', 'b']);
    expect(input.map((item) => item.id)).toEqual(['b', 'a']);
  });
});

describe('answersWithQuestions', () => {
  it('[TC-04-04] pairs every user answer with the question before it, ordered by seq', () => {
    const pairs = answersWithQuestions([
      testUtterance({ id: 'd', seq: 4, role: 'user', text: 'Second answer' }),
      testUtterance({ id: 'b', seq: 2, role: 'user', text: 'First answer' }),
      testUtterance({ id: 'a', seq: 1, role: 'assistant', text: 'First?' }),
      testUtterance({ id: 'c', seq: 3, role: 'assistant', text: 'Second?' }),
      testUtterance({
        id: 'e',
        seq: 5,
        role: 'assistant',
        text: 'Unanswered?',
      }),
    ]);

    expect(
      pairs.map(({ question, answer }) => [question?.text, answer.text]),
    ).toEqual([
      ['First?', 'First answer'],
      ['Second?', 'Second answer'],
    ]);
  });

  it('[TC-04-04] leaves the question empty for an answer without one before it', () => {
    const pairs = answersWithQuestions([
      testUtterance({ id: 'b', seq: 1, role: 'user', text: 'Orphan' }),
    ]);

    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.question).toBeUndefined();
  });

  it('[TC-04-04] returns nothing for a session without answers', () => {
    expect(answersWithQuestions([testUtterance()])).toEqual([]);
  });
});

describe('awaitingReply', () => {
  it('[TC-04-08] is true when the last utterance by seq is a user answer', () => {
    expect(
      awaitingReply([
        testUtterance({ id: 'b', seq: 2, role: 'user', text: 'My answer' }),
        testUtterance({ id: 'a', seq: 1, role: 'assistant', text: 'First?' }),
      ]),
    ).toBe(true);
  });

  it('[TC-04-08] is false when the last utterance by seq is a question', () => {
    expect(
      awaitingReply([
        testUtterance({ id: 'a', seq: 1, role: 'assistant', text: 'First?' }),
        testUtterance({ id: 'b', seq: 2, role: 'user', text: 'My answer' }),
        testUtterance({ id: 'c', seq: 3, role: 'assistant', text: 'Next?' }),
      ]),
    ).toBe(false);
  });

  it('[TC-04-08] is false without any utterance', () => {
    expect(awaitingReply([])).toBe(false);
  });
});
