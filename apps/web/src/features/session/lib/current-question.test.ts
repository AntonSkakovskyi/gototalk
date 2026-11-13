import { testUtterance } from '@/shared/testing/test-fixtures';
import { currentQuestion } from './current-question';

describe('currentQuestion', () => {
  it('[TC-03-03] returns the text of the last assistant utterance', () => {
    expect(
      currentQuestion([
        testUtterance({ id: 'a', seq: 1, role: 'assistant', text: 'First?' }),
        testUtterance({ id: 'b', seq: 2, role: 'user', text: 'My answer' }),
        testUtterance({ id: 'c', seq: 3, role: 'assistant', text: 'Second?' }),
      ]),
    ).toBe('Second?');
  });

  it('[TC-03-03] ignores the order of the array and trusts seq', () => {
    expect(
      currentQuestion([
        testUtterance({ id: 'c', seq: 3, role: 'assistant', text: 'Second?' }),
        testUtterance({ id: 'a', seq: 1, role: 'assistant', text: 'First?' }),
      ]),
    ).toBe('Second?');
  });

  it('[TC-03-03] does not take a trailing user utterance', () => {
    expect(
      currentQuestion([
        testUtterance({ id: 'a', seq: 1, role: 'assistant', text: 'First?' }),
        testUtterance({ id: 'b', seq: 2, role: 'user', text: 'My answer' }),
      ]),
    ).toBe('First?');
  });

  it('[TC-03-03] returns undefined when the assistant has not spoken', () => {
    expect(currentQuestion([])).toBeUndefined();
  });
});
