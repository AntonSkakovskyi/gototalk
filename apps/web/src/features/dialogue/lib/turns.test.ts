import { testUtterance } from '@/shared/testing/test-fixtures';
import { currentQuestion, sortBySeq } from './turns';

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
