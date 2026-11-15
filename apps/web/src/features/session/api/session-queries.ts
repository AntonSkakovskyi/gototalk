import type { PlanSessionRequest } from '@gototalk/shared';
import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { retryUnlessClientError } from '@/shared/api/retry-policy';
import { sessionKeys } from '@/entities/session/api/session-details';
import { listHistory, listSessions, planSession } from './session-api';

const MAX_LIST_RETRIES = 1;
const MAX_PLAN_RETRIES = 1;
const MAX_HISTORY_RETRIES = 1;

export function sessionListQueryOptions() {
  return queryOptions({
    queryKey: sessionKeys.list(),
    queryFn: listSessions,
    retry: retryUnlessClientError(MAX_LIST_RETRIES),
  });
}

export function sessionHistoryQueryOptions() {
  return infiniteQueryOptions({
    queryKey: sessionKeys.history(),
    queryFn: ({ pageParam }) => listHistory({ cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: retryUnlessClientError(MAX_HISTORY_RETRIES),
  });
}

// A plan costs a model call and is fetched by POST: never refetch it implicitly.
// gcTime 0 drops a plan as soon as no screen observes it, so each visit gets a fresh one.
export function sessionPlanQueryOptions(request: PlanSessionRequest) {
  return queryOptions({
    queryKey: sessionKeys.plan(request),
    queryFn: () => planSession(request),
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: retryUnlessClientError(MAX_PLAN_RETRIES),
  });
}
