import { ERROR_CODES } from '@gototalk/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  currentLocation,
  renderAppWithProbe,
} from '@/app/router/guards/guard-test-helpers';
import { sessionKeys } from '@/shared/api/session-details';
import uk from '@/shared/i18n/uk.json';
import { deferred } from '@/shared/testing/answer-flow-setup';
import { createTestQueryClient } from '@/shared/testing/query-wrapper';
import { mockApi } from '@/shared/testing/mock-api';
import { reportOk } from '@/shared/testing/report-mocks';
import {
  TEST_PROFILE,
  TEST_USER,
  errorResponse,
  jsonResponse,
  testSessionDetails,
  testTurnResult,
  testUtterance,
} from '@/shared/testing/test-fixtures';

const AUTH = {
  accessToken: 'access-1',
  user: { ...TEST_USER, consentAt: '2026-01-01T10:00:00.000Z' },
};
const TURN = testTurnResult();
const FIRST_QUESTION = testUtterance();
const SECOND_QUESTION = TURN.reply ?? testUtterance();
const FINISHED = testSessionDetails({
  status: 'finished',
  feedbackMode: 'deferred',
  endedAt: '2026-11-13T10:07:20.000Z',
  planRemaining: 3,
  utterances: [FIRST_QUESTION, TURN.utterance, SECOND_QUESTION],
});
const ROUTE = `/sessions/${FINISHED.id}/report`;
const DETAILS_ROUTE = `GET /api/sessions/${FINISHED.id}`;
const REPORT_ROUTE = `${DETAILS_ROUTE}/report`;

type Reply = Response | (() => Response | Promise<Response>);

function renderReport(reply: Reply, report: Reply = reportOk) {
  const { requests } = mockApi({
    'GET /api/profile': jsonResponse(TEST_PROFILE),
    [DETAILS_ROUTE]: reply,
    [REPORT_ROUTE]: report,
  });
  renderAppWithProbe({ route: ROUTE, session: AUTH });
  return { requests };
}

describe('ReportPage route', () => {
  it('[TC-04-04] sends an active session back to the dialogue', async () => {
    const { requests } = renderReport(
      jsonResponse({ ...FINISHED, status: 'active', endedAt: null }),
    );

    expect(
      await screen.findByLabelText(uk.dialogue.form.label),
    ).toBeInTheDocument();
    expect(currentLocation()).toBe(`/sessions/${FINISHED.id}`);
    expect(requests.map(({ path }) => path)).not.toContain(
      REPORT_ROUTE.replace('GET ', ''),
    );
    expect(
      screen.queryByRole('heading', {
        level: 2,
        name: uk.report.summary.title,
      }),
    ).not.toBeInTheDocument();
  });

  it('[TC-04-04] does not redirect on stale cached active data once the refetch says finished', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(
      sessionKeys.details(FINISHED.id),
      { ...FINISHED, status: 'active', endedAt: null },
      { updatedAt: 0 },
    );
    const refetch = deferred();
    mockApi({
      'GET /api/profile': jsonResponse(TEST_PROFILE),
      [DETAILS_ROUTE]: () => refetch.promise,
      [REPORT_ROUTE]: reportOk,
    });
    renderAppWithProbe({ route: ROUTE, session: AUTH, queryClient });

    expect(
      await screen.findByRole('link', { name: uk.common.actions.home }),
    ).toBeInTheDocument();
    await waitFor(() => expect(queryClient.isFetching()).toBe(1));
    expect(currentLocation()).toBe(ROUTE);

    refetch.resolve(jsonResponse(FINISHED));

    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: uk.report.summary.title,
      }),
    ).toBeInTheDocument();
    expect(currentLocation()).toBe(ROUTE);
  });

  it('[TC-04-04] [TC-05-07] shows the topic, the summary stats and the deep analysis toggle', async () => {
    renderReport(jsonResponse(FINISHED));

    expect(
      await screen.findByRole('heading', { level: 1, name: FINISHED.topic }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: uk.report.summary.title,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
    expect(screen.getByText('5 відповідей')).toBeInTheDocument();
    expect(screen.getByText('6 хвилин')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: uk.report.deep.open }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.getByRole('link', { name: uk.common.actions.home }),
    ).toHaveAttribute('href', '/');
    expect(currentLocation()).toBe(ROUTE);
  });

  it('[TC-05-07] shows the summary above the deep analysis', async () => {
    renderReport(jsonResponse(FINISHED));

    const heading = await screen.findByRole('heading', {
      level: 2,
      name: uk.report.summary.title,
    });
    const toggle = screen.getByRole('button', { name: uk.report.deep.open });

    expect(
      screen.getByText(
        'You answered fluently, but past tenses need more practice.',
      ),
    ).toBeInTheDocument();
    expect(
      heading.compareDocumentPosition(toggle) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('[TC-05-07] shows no deep analysis when the report fails to load', async () => {
    renderReport(jsonResponse(FINISHED), () =>
      errorResponse(500, 'INTERNAL_ERROR'),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.errors.generic,
    );
    expect(
      screen.queryByRole('button', { name: uk.report.deep.open }),
    ).not.toBeInTheDocument();
  });

  it('[TC-04-11] [TC-05-06] highlights the mistakes in the deep analysis although feedback was deferred', async () => {
    const user = userEvent.setup();
    renderReport(jsonResponse(FINISHED));

    await user.click(
      await screen.findByRole('button', { name: uk.report.deep.open }),
    );
    await user.click(await screen.findByRole('button', { name: 'go' }));

    expect(
      screen.getByText(TURN.utterance.mistakes[0]?.explanationEn ?? ''),
    ).toBeInTheDocument();
  });

  it('[TC-04-04] shows the loading state with a single heading and the home link', async () => {
    renderReport(() => new Promise<Response>(() => undefined));

    expect(
      await screen.findByRole('link', { name: uk.common.actions.home }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(
      screen.queryByRole('heading', {
        level: 2,
        name: uk.report.summary.title,
      }),
    ).not.toBeInTheDocument();
  });

  it('[TC-03-03] shows the not-found message for an unknown session', async () => {
    renderReport(errorResponse(404, ERROR_CODES.SESSION_NOT_FOUND));

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: uk.session.errors.notFound,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', {
        level: 2,
        name: uk.report.summary.title,
      }),
    ).not.toBeInTheDocument();
  });

  it('[TC-03-03] shows a load error with retry that recovers', async () => {
    const user = userEvent.setup();
    let failing = true;
    renderReport(() =>
      failing ? errorResponse(500, 'INTERNAL_ERROR') : jsonResponse(FINISHED),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.errors.generic,
    );
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);

    failing = false;
    await user.click(
      screen.getByRole('button', { name: uk.common.actions.retry }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole('heading', {
          level: 2,
          name: uk.report.summary.title,
        }),
      ).toBeInTheDocument(),
    );
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});
