import { ERROR_CODES } from '@gototalk/shared';
import { QueryClient } from '@tanstack/react-query';
import { sessionKeys } from '@/shared/api/session-details';
import {
  mockReportApi,
  REPORT_SESSION_ID,
} from '@/shared/testing/report-mocks';
import { errorResponse } from '@/shared/testing/http-responses';
import { testReport } from '@/shared/testing/fixtures/report';
import { reportQueryOptions } from './report-queries';

describe('report queries', () => {
  it('[TC-05-03] the query uses the shared session report key', () => {
    expect(reportQueryOptions('abc').queryKey).toEqual(
      sessionKeys.report('abc'),
    );
  });

  it('[TC-05-03] a fresh cached report is served without a request', async () => {
    const { requests } = mockReportApi();
    const queryClient = new QueryClient();
    const options = reportQueryOptions(REPORT_SESSION_ID);

    await queryClient.query(options);
    await queryClient.query(options);

    expect(requests).toHaveLength(1);
  });

  it('[TC-05-03] the query does not retry a 4xx', async () => {
    const { requests } = mockReportApi({
      report: () => errorResponse(409, ERROR_CODES.SESSION_NOT_FINISHED),
    });

    await expect(
      new QueryClient().query({
        ...reportQueryOptions(REPORT_SESSION_ID),
        retryDelay: 0,
      }),
    ).rejects.toMatchObject({ status: 409 });

    expect(requests).toHaveLength(1);
  });

  it('[TC-05-03] the query retries a 5xx once', async () => {
    const replies = [errorResponse(500, 'BOOM'), undefined];
    const { requests } = mockReportApi({
      report: () => {
        const failure = replies.shift();
        return failure ?? Response.json(testReport());
      },
    });

    await expect(
      new QueryClient().query({
        ...reportQueryOptions(REPORT_SESSION_ID),
        retryDelay: 0,
      }),
    ).resolves.toEqual(testReport());

    expect(requests).toHaveLength(2);
  });
});
