import { mockApi } from './mock-api';
import { jsonResponse, testReport } from './test-fixtures';

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
