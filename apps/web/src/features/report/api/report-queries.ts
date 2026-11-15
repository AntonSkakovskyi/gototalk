import { queryOptions } from '@tanstack/react-query';
import { retryUnlessClientError } from '@/shared/api/retry-policy';
import { sessionKeys } from '@/shared/api/session-details';
import { getReport } from './report-api';

const MAX_REPORT_RETRIES = 1;
const REPORT_STALE_TIME_MS = 30_000;

export function reportQueryOptions(sessionId: string) {
  return queryOptions({
    queryKey: sessionKeys.report(sessionId),
    queryFn: () => getReport(sessionId),
    staleTime: REPORT_STALE_TIME_MS,
    retry: retryUnlessClientError(MAX_REPORT_RETRIES),
  });
}
