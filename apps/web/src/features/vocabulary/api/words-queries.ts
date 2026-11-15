import { infiniteQueryOptions } from '@tanstack/react-query';
import { retryUnlessClientError } from '@/shared/api/retry-policy';
import { listWords } from './words-api';

const MAX_LIST_RETRIES = 1;

export const wordKeys = {
  all: ['words'] as const,
  list: () => [...wordKeys.all, 'list'] as const,
};

export function wordsListQueryOptions() {
  return infiniteQueryOptions({
    queryKey: wordKeys.list(),
    queryFn: ({ pageParam }) => listWords({ cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: retryUnlessClientError(MAX_LIST_RETRIES),
  });
}
