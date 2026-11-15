import { SessionReportSchema, type SessionReport } from '@gototalk/shared';
import { apiFetch } from '@/shared/api/http';
import { sessionApiPath } from '@/shared/api/session-details';

export function getReport(sessionId: string): Promise<SessionReport> {
  return apiFetch(`${sessionApiPath(sessionId)}/report`, {
    schema: SessionReportSchema,
  });
}
