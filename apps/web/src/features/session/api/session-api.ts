import {
  SessionDetailsSchema,
  SessionListSchema,
  SessionPageSchema,
  SessionPlanSchema,
  type PlanSessionRequest,
  type Session,
  type SessionPage,
  type SessionDetails,
  type SessionPlan,
  type StartSessionRequest,
} from '@gototalk/shared';
import { apiFetch } from '@/shared/api/http';
import { pageQueryString } from '@/shared/api/page-query';

export function planSession(request: PlanSessionRequest): Promise<SessionPlan> {
  return apiFetch('/api/sessions/plan', {
    method: 'POST',
    body: request,
    schema: SessionPlanSchema,
  });
}

export function startSession(
  request: StartSessionRequest,
): Promise<SessionDetails> {
  return apiFetch('/api/sessions', {
    method: 'POST',
    body: request,
    schema: SessionDetailsSchema,
  });
}

export function listSessions(): Promise<Session[]> {
  return apiFetch('/api/sessions', { schema: SessionListSchema });
}

interface HistoryQuery {
  cursor?: string | undefined;
  limit?: number | undefined;
}

export function listHistory({
  cursor,
  limit,
}: HistoryQuery = {}): Promise<SessionPage> {
  return apiFetch(
    `/api/sessions/history${pageQueryString({ cursor, limit })}`,
    {
      schema: SessionPageSchema,
    },
  );
}
