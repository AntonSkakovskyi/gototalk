import { mockApi } from '@/shared/testing/mock-api';
import { jsonResponse } from '@/shared/testing/http-responses';
import { testReport } from '@/shared/testing/fixtures/report';

type Reply = Response | Promise<Response>;

export const REPORT_SESSION_ID = testReport().sessionId;

export const reportOk = () => jsonResponse(testReport());

export function mockReportApi({
  report = reportOk,
}: { report?: () => Reply } = {}) {
  const { requests } = mockApi({
    [`GET /api/sessions/${REPORT_SESSION_ID}/report`]: report,
  });
  return { requests };
}
