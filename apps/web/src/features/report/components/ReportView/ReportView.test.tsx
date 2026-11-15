import { ERROR_CODES, type SessionDetails } from '@gototalk/shared';
import { useQuery } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { reportQueryOptions } from '@/features/report/api/report-queries';
import uk from '@/shared/i18n/uk.json';
import {
  REPORT_SESSION_ID,
  mockReportApi,
  reportOk,
} from '@/features/report/testing/report-mocks';
import { errorResponse, jsonResponse } from '@/shared/testing/http-responses';
import { testReport } from '@/shared/testing/fixtures/report';
import {
  testSessionDetails,
  testTurnResult,
  testUtterance,
} from '@/shared/testing/fixtures/session';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { ReportView } from './ReportView';

const text = uk.report.summary;

function Harness({ details }: { details?: SessionDetails }) {
  const query = useQuery(reportQueryOptions(REPORT_SESSION_ID));
  return <ReportView query={query} details={details} />;
}

describe('ReportView', () => {
  it('[TC-05-07] announces loading and then shows the summary', async () => {
    mockReportApi();
    renderWithProviders(<Harness />);

    expect(
      screen.getByRole('status', { name: uk.common.loading }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { level: 2, name: text.title }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText('5 відповідей')).toBeInTheDocument();
    expect(
      screen.getByText(`${uk.mistakeCategories.verb_tense} – 2`),
    ).toBeInTheDocument();
  });

  it('[TC-05-07] retries an unavailable summary and then shows the text', async () => {
    const user = userEvent.setup();
    let calls = 0;
    const { requests } = mockReportApi({
      report: () => {
        calls += 1;
        return calls === 1
          ? jsonResponse(testReport({ summary: { status: 'unavailable' } }))
          : reportOk();
      },
    });
    renderWithProviders(<Harness />);

    await user.click(
      await screen.findByRole('button', { name: uk.common.actions.retry }),
    );

    expect(
      await screen.findByText(
        'You answered fluently, but past tenses need more practice.',
      ),
    ).toBeInTheDocument();
    expect(requests).toHaveLength(2);
    expect(screen.queryByText(text.unavailable)).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('[TC-05-07] shows the no-answers message', async () => {
    mockReportApi({
      report: () =>
        jsonResponse(
          testReport({
            answers: 0,
            summary: { status: 'no_answers' },
            categories: [],
          }),
        ),
    });
    renderWithProviders(<Harness />);

    expect(await screen.findByText(text.noAnswers)).toBeInTheDocument();
  });

  it('[TC-05-07] shows a load error in an alert and recovers on retry', async () => {
    const user = userEvent.setup();
    let failing = true;
    mockReportApi({
      report: () =>
        failing ? errorResponse(500, 'INTERNAL_ERROR') : reportOk(),
    });
    renderWithProviders(<Harness />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.errors.generic,
    );

    failing = false;
    await user.click(
      screen.getByRole('button', { name: uk.common.actions.retry }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 2, name: text.title }),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('[TC-05-07] shows the not-found message for an unknown session', async () => {
    mockReportApi({
      report: () => errorResponse(404, ERROR_CODES.SESSION_NOT_FOUND),
    });
    renderWithProviders(<Harness />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.session.errors.notFound,
    );
  });

  it('[TC-05-07] explains that an unfinished session has no report yet', async () => {
    mockReportApi({
      report: () => errorResponse(409, ERROR_CODES.SESSION_NOT_FINISHED),
    });
    renderWithProviders(<Harness />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.report.errors.notFinished,
    );
  });

  it('[TC-05-06] shows the deep analysis toggle under the summary only when the details are known', async () => {
    mockReportApi();
    const { unmount } = renderWithProviders(<Harness />);
    await screen.findByRole('heading', { level: 2, name: text.title });
    expect(
      screen.queryByRole('button', { name: uk.report.deep.open }),
    ).not.toBeInTheDocument();
    unmount();

    mockReportApi();
    renderWithProviders(
      <Harness
        details={testSessionDetails({
          status: 'finished',
          utterances: [testUtterance(), testTurnResult().utterance],
        })}
      />,
    );

    expect(
      await screen.findByRole('button', { name: uk.report.deep.open }),
    ).toBeInTheDocument();
  });
});
