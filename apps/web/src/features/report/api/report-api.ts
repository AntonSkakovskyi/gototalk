import { SessionReportSchema, type SessionReport } from '@gototalk/shared';
import { apiFetch } from '@/shared/api/http';
import { sessionApiPath } from '@/entities/session/api/session-details';

export function getReport(sessionId: string): Promise<SessionReport> {
  return apiFetch(`${sessionApiPath(sessionId)}/report`, {
    schema: SessionReportSchema,
  });
}
