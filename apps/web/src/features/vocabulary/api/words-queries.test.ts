import { ERROR_CODES } from '@gototalk/shared';
import { QueryClient } from '@tanstack/react-query';
import { mockApi } from '@/shared/testing/mock-api';
import {
  errorResponse,
  jsonResponse,
  testWord,
} from '@/shared/testing/test-fixtures';
import { wordKeys, wordsListQueryOptions } from './words-queries';

describe('words queries', () => {
  it('[TC-05-05] list query uses the shared key and the first page has no cursor', async () => {
    const page = { items: [testWord()], nextCursor: null };
    const { requests } = mockApi({ 'GET /api/words': jsonResponse(page) });
    const options = wordsListQueryOptions();

    const data = await new QueryClient().fetchInfiniteQuery(options);

    expect(options.queryKey).toEqual(wordKeys.list());
    expect(data.pages).toEqual([page]);
    expect(requests).toHaveLength(1);
  });

  it('[TC-05-05] list query pages by the previous nextCursor and stops on null', async () => {
    const { requests } = mockApi({
      'GET /api/words': jsonResponse({ items: [], nextCursor: 'c1' }),
      'GET /api/words?cursor=c1': jsonResponse({ items: [], nextCursor: null }),
    });

    await new QueryClient().fetchInfiniteQuery({
      ...wordsListQueryOptions(),
      pages: 3,
    });

    expect(requests.map((request) => request.path)).toEqual([
      '/api/words',
      '/api/words?cursor=c1',
    ]);
  });

  it('[TC-05-05] list query does not retry a 4xx', async () => {
    const { requests } = mockApi({
      'GET /api/words': errorResponse(403, ERROR_CODES.CONSENT_REQUIRED),
    });

    await expect(
      new QueryClient().fetchInfiniteQuery({
        ...wordsListQueryOptions(),
        retryDelay: 0,
      }),
    ).rejects.toMatchObject({ status: 403 });

    expect(requests).toHaveLength(1);
  });

  it('[TC-05-05] list query retries a server error once', async () => {
    const queue = [
      errorResponse(500, 'BOOM'),
      jsonResponse({ items: [], nextCursor: null }),
    ];
    const { requests } = mockApi({
      'GET /api/words': () =>
        queue.shift() ?? errorResponse(500, 'RESPONSES_EXHAUSTED'),
    });

    await new QueryClient().fetchInfiniteQuery({
      ...wordsListQueryOptions(),
      retryDelay: 0,
    });

    expect(requests).toHaveLength(2);
  });
});
