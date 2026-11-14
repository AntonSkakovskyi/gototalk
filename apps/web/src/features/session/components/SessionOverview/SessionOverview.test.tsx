import { ERROR_CODES } from '@gototalk/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useQuery } from '@tanstack/react-query';
import {
  sessionDetailsQueryOptions,
  sessionKeys,
} from '@/shared/api/session-details';
import uk from '@/shared/i18n/uk.json';
import { mockApi } from '@/shared/testing/mock-api';
import { createTestQueryClient } from '@/shared/testing/query-wrapper';
import {
  errorResponse,
  jsonResponse,
  testSessionDetails,
} from '@/shared/testing/test-fixtures';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { SessionOverview } from './SessionOverview';

const DETAILS = testSessionDetails();
const PATH = `GET /api/sessions/${DETAILS.id}`;

function Harness() {
  const details = useQuery(sessionDetailsQueryOptions(DETAILS.id));
  return <SessionOverview details={details} />;
}

function renderOverview(queryClient = createTestQueryClient()) {
  return renderWithProviders(<Harness />, { queryClient });
}

describe('SessionOverview', () => {
  it('[TC-03-03] fetches on a direct visit and shows the topic, status and feedback mode', async () => {
    const { requests } = mockApi({ [PATH]: jsonResponse(DETAILS) });
    renderOverview();

    expect(
      screen.getByRole('status', { name: uk.common.loading }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { level: 1, name: DETAILS.topic }),
    ).toBeInTheDocument();
    expect(screen.getByText(uk.session.details.topicLabel)).toBeInTheDocument();
    expect(screen.getByText(uk.session.status.active)).toBeInTheDocument();
    expect(
      screen.getByText(uk.session.details.feedbackMode.immediate),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(requests).toHaveLength(1);
  });

  it('[TC-03-03] keeps exactly one generic h1 while loading', () => {
    mockApi({ [PATH]: () => new Promise<Response>(() => undefined) });
    renderOverview();

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: uk.session.details.pageTitle,
      }),
    ).toBeInTheDocument();
  });

  it('[TC-03-03] moves focus to the topic heading once the content appears', async () => {
    mockApi({ [PATH]: jsonResponse(DETAILS) });
    renderOverview();

    const heading = await screen.findByRole('heading', {
      level: 1,
      name: DETAILS.topic,
    });

    await waitFor(() => expect(heading).toHaveFocus());
  });

  it('[TC-03-03] moves focus to the not-found heading', async () => {
    mockApi({ [PATH]: errorResponse(404, ERROR_CODES.SESSION_NOT_FOUND) });
    renderOverview();

    const heading = await screen.findByRole('heading', {
      level: 1,
      name: uk.session.errors.notFound,
    });

    await waitFor(() => expect(heading).toHaveFocus());
  });

  it('[TC-03-03] leaves a custom topic unmarked', async () => {
    mockApi({
      [PATH]: jsonResponse(
        testSessionDetails({ topic: 'Мій кіт', topicSource: 'custom' }),
      ),
    });
    renderOverview();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Мій кіт' }),
    ).not.toHaveAttribute('lang');
  });

  it('[TC-03-03] marks a suggested topic as English', async () => {
    mockApi({ [PATH]: jsonResponse(DETAILS) });
    renderOverview();

    expect(
      await screen.findByRole('heading', { level: 1, name: DETAILS.topic }),
    ).toHaveAttribute('lang', 'en');
  });

  it('[TC-03-03] shows a freshly started session from the cache without a request', () => {
    const { requests } = mockApi({});
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(sessionKeys.details(DETAILS.id), DETAILS);

    renderOverview(queryClient);

    expect(
      screen.getByRole('heading', { level: 1, name: DETAILS.topic }),
    ).toBeInTheDocument();
    expect(requests).toHaveLength(0);
  });

  it('[TC-03-03] shows the finished badge and the deferred mode of a finished session', async () => {
    mockApi({
      [PATH]: jsonResponse(
        testSessionDetails({
          status: 'finished',
          feedbackMode: 'deferred',
          endedAt: '2026-11-13T10:20:00.000Z',
        }),
      ),
    });
    renderOverview();

    expect(
      await screen.findByText(uk.session.status.finished),
    ).toBeInTheDocument();
    expect(
      screen.getByText(uk.session.details.feedbackMode.deferred),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(uk.session.status.active),
    ).not.toBeInTheDocument();
  });

  it('[TC-03-03] explains a missing session', async () => {
    mockApi({
      [PATH]: errorResponse(404, ERROR_CODES.SESSION_NOT_FOUND),
    });
    renderOverview();

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: uk.session.errors.notFound,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('[TC-03-03] shows an error with retry that recovers', async () => {
    const user = userEvent.setup();
    let failing = true;
    mockApi({
      [PATH]: () =>
        failing ? errorResponse(500, 'INTERNAL_ERROR') : jsonResponse(DETAILS),
    });
    renderOverview();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.errors.generic,
    );
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);

    failing = false;
    await user.click(
      screen.getByRole('button', { name: uk.common.actions.retry }),
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: DETAILS.topic }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
