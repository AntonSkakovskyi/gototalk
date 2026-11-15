import { ERROR_CODES } from '@gototalk/shared';
import { mockApi } from '@/shared/testing/mock-api';
import {
  errorResponse,
  jsonResponse,
  testWord,
} from '@/shared/testing/test-fixtures';
import { mockWordsApi } from '@/shared/testing/words-mocks';
import { markWord } from './words-api';

describe('words api', () => {
  it('[TC-05-05] markWord patches the state and returns the validated word', async () => {
    const word = testWord();
    const { requests } = mockWordsApi({ words: [word] });

    await expect(markWord(word.id, 'passive')).resolves.toEqual({
      ...word,
      state: 'passive',
    });

    expect(requests).toEqual([
      {
        method: 'PATCH',
        path: `/api/words/${word.id}`,
        body: { state: 'passive' },
      },
    ]);
  });

  it('[TC-05-05] markWord encodes the word id in the path', async () => {
    const { requests } = mockApi({
      'PATCH /api/words/a%2Fb': jsonResponse(testWord()),
    });

    await markWord('a/b', 'new');

    expect(requests[0]?.path).toBe('/api/words/a%2Fb');
  });

  it.each([
    [404, ERROR_CODES.WORD_NOT_FOUND],
    [409, ERROR_CODES.WORD_ALREADY_ACTIVE],
  ])('[TC-05-05] markWord surfaces %i %s', async (status, code) => {
    const word = testWord();
    mockWordsApi({ words: [word], mark: () => errorResponse(status, code) });

    await expect(markWord(word.id, 'new')).rejects.toMatchObject({
      status,
      code,
    });
  });

  it('[TC-05-05] markWord rejects a response that breaks the contract', async () => {
    const word = testWord();
    mockWordsApi({
      words: [word],
      mark: () => jsonResponse({ ...word, state: 'unknown' }),
    });

    await expect(markWord(word.id, 'new')).rejects.toThrow();
  });
});
