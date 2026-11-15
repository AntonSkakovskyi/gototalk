import { testUtterance } from '@/shared/testing/test-fixtures';
import { questionsByAnswer } from './questions-by-answer';

describe('questionsByAnswer', () => {
  it('[TC-05-06] maps every answer to the closest assistant utterance before it, ignoring input order', () => {
    const questions = questionsByAnswer([
      testUtterance({ id: 'd', seq: 4, role: 'user', text: 'Second answer' }),
      testUtterance({ id: 'b', seq: 2, role: 'user', text: 'First answer' }),
      testUtterance({ id: 'a', seq: 1, role: 'assistant', text: 'First?' }),
      testUtterance({ id: 'c', seq: 3, role: 'assistant', text: 'Second?' }),
    ]);

    expect(questions.get('b')?.text).toBe('First?');
    expect(questions.get('d')?.text).toBe('Second?');
  });

  it('[TC-05-06] has no entry for an answer without a question before it', () => {
    const questions = questionsByAnswer([
      testUtterance({ id: 'b', seq: 1, role: 'user' }),
    ]);

    expect(questions.has('b')).toBe(false);
  });
});
