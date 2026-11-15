import { ERROR_CODES } from '@gototalk/shared';
import {
  mockReportApi,
  REPORT_SESSION_ID,
} from '@/features/report/testing/report-mocks';
import { mockApi } from '@/shared/testing/mock-api';
import { errorResponse, jsonResponse } from '@/shared/testing/http-responses';
import { testReport } from '@/shared/testing/fixtures/report';
import { getReport } from './report-api';

describe('report api', () => {
  it('[TC-05-03] getReport reads the report by session id', async () => {
    const { requests } = mockReportApi();

    await expect(getReport(REPORT_SESSION_ID)).resolves.toEqual(testReport());

    expect(requests).toEqual([
      {
        method: 'GET',
        path: `/api/sessions/${REPORT_SESSION_ID}/report`,
        body: undefined,
      },
    ]);
  });

  it('[TC-05-03] getReport encodes the session id in the path', async () => {
    const { requests } = mockApi({
      'GET /api/sessions/a%2Fb/report': jsonResponse(testReport()),
    });

    await getReport('a/b');

    expect(requests[0]?.path).toBe('/api/sessions/a%2Fb/report');
  });

  it('[TC-05-03] getReport surfaces SESSION_NOT_FINISHED', async () => {
    mockReportApi({
      report: () => errorResponse(409, ERROR_CODES.SESSION_NOT_FINISHED),
    });

    await expect(getReport(REPORT_SESSION_ID)).rejects.toMatchObject({
      status: 409,
      code: ERROR_CODES.SESSION_NOT_FINISHED,
    });
  });

  it('[TC-05-03] getReport rejects a response that breaks the contract', async () => {
    mockReportApi({ report: () => jsonResponse({ sessionId: 'not-a-uuid' }) });

    await expect(getReport(REPORT_SESSION_ID)).rejects.toThrow();
  });
});
