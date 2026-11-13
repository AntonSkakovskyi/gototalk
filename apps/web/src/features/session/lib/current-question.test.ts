import { currentQuestion } from './current-question';

describe('currentQuestion', () => {
  it('[TC-03-03] returns the text of the last assistant utterance', () => {
    expect(
      currentQuestion([
        { id: 'a', seq: 1, role: 'assistant', text: 'First?' },
        { id: 'b', seq: 2, role: 'user', text: 'My answer' },
        { id: 'c', seq: 3, role: 'assistant', text: 'Second?' },
      ]),
    ).toBe('Second?');
  });

  it('[TC-03-03] ignores the order of the array and trusts seq', () => {
    expect(
      currentQuestion([
        { id: 'c', seq: 3, role: 'assistant', text: 'Second?' },
        { id: 'a', seq: 1, role: 'assistant', text: 'First?' },
      ]),
    ).toBe('Second?');
  });

  it('[TC-03-03] does not take a trailing user utterance', () => {
    expect(
      currentQuestion([
        { id: 'a', seq: 1, role: 'assistant', text: 'First?' },
        { id: 'b', seq: 2, role: 'user', text: 'My answer' },
      ]),
    ).toBe('First?');
  });

  it('[TC-03-03] returns undefined when the assistant has not spoken', () => {
    expect(currentQuestion([])).toBeUndefined();
  });
});
