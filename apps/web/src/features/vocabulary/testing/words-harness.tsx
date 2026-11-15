import {
  SessionReportSchema,
  type MarkWordRequest,
  type Word,
} from '@gototalk/shared';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { apiFetch } from '@/shared/api/http';
import { sessionKeys } from '@/entities/session/api/session-details';
import { createTestQueryClient } from '@/shared/testing/query-wrapper';
import { jsonResponse } from '@/shared/testing/http-responses';
import { testReport } from '@/shared/testing/fixtures/report';
import { testSession } from '@/shared/testing/fixtures/session';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { mockWordsApi } from '@/shared/testing/words-mocks';

const SESSION_ID = testSession().id;
const REPORT_PATH = `/api/sessions/${SESSION_ID}/report`;
const STALE_TIME_MS = 30_000;

interface HarnessProps {
  children: (words: Word[]) => ReactNode;
}

function Harness({ children }: HarnessProps) {
  const query = useQuery({
    queryKey: sessionKeys.report(SESSION_ID),
    queryFn: () => apiFetch(REPORT_PATH, { schema: SessionReportSchema }),
    staleTime: STALE_TIME_MS,
  });
  return query.data ? <>{children(query.data.words)}</> : null;
}

type MarkReply = (
  id: string,
  body: MarkWordRequest,
) => Response | Promise<Response>;

/** A fake server that remembers marks, so a refetched report shows them; `mark` overrides the PATCH reply. */
export function renderWithWords(
  initial: Word[],
  children: HarnessProps['children'],
  mark?: MarkReply,
) {
  let current = initial;
  const api = mockWordsApi({
    words: initial,
    mark:
      mark ??
      ((id, body) => {
        current = current.map((word) =>
          word.id === id ? { ...word, state: body.state } : word,
        );
        return jsonResponse(current.find((word) => word.id === id));
      }),
    extraRoutes: {
      [`GET ${REPORT_PATH}`]: () =>
        jsonResponse(testReport({ sessionId: SESSION_ID, words: current })),
    },
  });
  const queryClient = createTestQueryClient();
  renderWithProviders(<Harness>{children}</Harness>, { queryClient });
  return {
    ...api,
    queryClient,
    reportRequests: () =>
      api.requests.filter((request) => request.path === REPORT_PATH),
  };
}
