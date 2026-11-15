import {
  SessionDetailsSchema,
  type PlanSessionRequest,
  type SessionDetails,
} from '@gototalk/shared';
import { queryOptions } from '@tanstack/react-query';
import { apiFetch } from './http';
import { retryUnlessClientError } from './retry-policy';

export const sessionKeys = {
  all: ['session'] as const,
  list: () => [...sessionKeys.all, 'list'] as const,
  allDetails: () => [...sessionKeys.all, 'details'] as const,
  details: (id: string) => [...sessionKeys.allDetails(), id] as const,
  allReports: () => [...sessionKeys.all, 'report'] as const,
  report: (id: string) => [...sessionKeys.allReports(), id] as const,
  plan: (request: PlanSessionRequest) =>
    [...sessionKeys.all, 'plan', request] as const,
};

export function sessionApiPath(id: string): string {
  return `/api/sessions/${encodeURIComponent(id)}`;
}

const MAX_DETAILS_RETRIES = 1;
const DETAILS_STALE_TIME_MS = 30_000;

export function getSession(id: string): Promise<SessionDetails> {
  return apiFetch(sessionApiPath(id), {
    schema: SessionDetailsSchema,
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
