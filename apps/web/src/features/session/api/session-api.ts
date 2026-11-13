import {
  SessionDetailsSchema,
  SessionListSchema,
  SessionPlanSchema,
  type PlanSessionRequest,
  type Session,
  type SessionDetails,
  type SessionPlan,
  type StartSessionRequest,
} from '@gototalk/shared';
import { apiFetch } from '@/shared/api/http';

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

export function getSession(id: string): Promise<SessionDetails> {
  return apiFetch(`/api/sessions/${id}`, { schema: SessionDetailsSchema });
}
