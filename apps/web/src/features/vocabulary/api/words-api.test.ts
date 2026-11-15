import { ERROR_CODES } from '@gototalk/shared';
import { mockApi } from '@/shared/testing/mock-api';
import { errorResponse, jsonResponse } from '@/shared/testing/http-responses';
import { testWord } from '@/shared/testing/fixtures/words';
import { mockWordsApi } from '@/shared/testing/words-mocks';
import { listWords, markWord } from './words-api';

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
  it('[TC-05-05] listWords requests the first page without a query string', async () => {
    const page = { items: [testWord()], nextCursor: 'c1' };
    const { requests } = mockApi({ 'GET /api/words': jsonResponse(page) });

    await expect(listWords()).resolves.toEqual(page);

    expect(requests.map((request) => request.path)).toEqual(['/api/words']);
  });

  it('[TC-05-05] listWords sends only the defined params, URL-encoded', async () => {
    const { requests } = mockApi({
      'GET /api/words?cursor=a%2Bb%3D%26c&limit=5': jsonResponse({
        items: [],
        nextCursor: null,
      }),
    });

    await listWords({ cursor: 'a+b=&c', limit: 5 });

    expect(requests).toHaveLength(1);
  });

  it('[TC-05-05] listWords omits an undefined cursor', async () => {
    const { requests } = mockApi({
      'GET /api/words?limit=3': jsonResponse({ items: [], nextCursor: null }),
    });

    await listWords({ cursor: undefined, limit: 3 });

    expect(requests).toHaveLength(1);
  });

  it('[TC-05-05] listWords rejects a response that breaks the contract', async () => {
    mockApi({ 'GET /api/words': jsonResponse([testWord()]) });

    await expect(listWords()).rejects.toThrow();
  });
});
