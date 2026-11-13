import type { PlanSessionRequest } from '@gototalk/shared';
import { queryOptions } from '@tanstack/react-query';
import { retryUnlessClientError } from '@/shared/api/retry-policy';
import { getSession, listSessions, planSession } from './session-api';

export const sessionKeys = {
  all: ['session'] as const,
  list: () => [...sessionKeys.all, 'list'] as const,
  details: (id: string) => [...sessionKeys.all, 'details', id] as const,
  plan: (request: PlanSessionRequest) =>
    [...sessionKeys.all, 'plan', request] as const,
};

const MAX_PLAN_RETRIES = 1;
const MAX_DETAILS_RETRIES = 1;
const DETAILS_STALE_TIME_MS = 30_000;

export function sessionListQueryOptions() {
  return queryOptions({
    queryKey: sessionKeys.list(),
    queryFn: listSessions,
  });
}

export function sessionDetailsQueryOptions(id: string) {
  return queryOptions({
    queryKey: sessionKeys.details(id),
    queryFn: () => getSession(id),
    staleTime: DETAILS_STALE_TIME_MS,
    retry: retryUnlessClientError(MAX_DETAILS_RETRIES),
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
