import type { Session } from '@gototalk/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import uk from '@/shared/i18n/uk.json';
import { mockApi } from '@/shared/testing/mock-api';
import {
  errorResponse,
  jsonResponse,
  testSession,
} from '@/shared/testing/test-fixtures';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { RecentSessions } from './RecentSessions';

const text = uk.session.home;
const status = uk.session.status;

const ACTIVE = testSession({
  id: '7c2e8b64-5f0a-4d1b-8e3a-2a9b4c6d0001',
  topic: 'Planning a team offsite',
  startedAt: '2026-11-13T12:00:00.000Z',
});
const FINISHED = testSession({
  id: '7c2e8b64-5f0a-4d1b-8e3a-2a9b4c6d0002',
  topic: 'My hometown',
  status: 'finished',
  startedAt: '2026-11-12T12:00:00.000Z',
  endedAt: '2026-11-12T12:20:00.000Z',
});

function stubSessions(sessions: Session[]) {
  mockApi({ 'GET /api/sessions': jsonResponse(sessions) });
}

describe('RecentSessions', () => {
  it('[TC-03-03] announces loading and then shows the list', async () => {
    stubSessions([FINISHED]);
    renderWithProviders(<RecentSessions />);

    expect(
      screen.getByRole('status', { name: uk.common.loading }),
    ).toBeInTheDocument();
    expect(await screen.findByText(FINISHED.topic)).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('[TC-03-03] shows an error with retry and recovers on retry', async () => {
    const user = userEvent.setup();
    let failing = true;
    mockApi({
      'GET /api/sessions': () =>
        failing
          ? errorResponse(500, 'INTERNAL_ERROR')
          : jsonResponse([FINISHED]),
    });
    renderWithProviders(<RecentSessions />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.errors.generic,
    );

    failing = false;
    await user.click(
      screen.getByRole('button', { name: uk.common.actions.retry }),
    );

    expect(await screen.findByText(FINISHED.topic)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('[TC-03-03] explains the empty state', async () => {
    stubSessions([]);
    renderWithProviders(<RecentSessions />);

    expect(await screen.findByText(text.recent.empty)).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('[TC-03-03] lists sessions under a labelled section with links to their pages', async () => {
    stubSessions([ACTIVE, FINISHED]);
    renderWithProviders(<RecentSessions />);

    const items = await screen.findAllByRole('listitem');
    const section = screen.getByRole('region', { name: text.recent.title });

    expect(within(section).getAllByRole('listitem')).toHaveLength(2);
    expect(
      within(items[0]!).getByRole('link', { name: /Planning a team offsite/ }),
    ).toHaveAttribute('href', `/sessions/${ACTIVE.id}`);
    expect(
      within(items[1]!).getByRole('link', { name: /My hometown/ }),
    ).toHaveAttribute('href', `/sessions/${FINISHED.id}`);
  });

  it('[TC-03-03] shows the status, the date and the continue action for an active session only', async () => {
    stubSessions([ACTIVE, FINISHED]);
    renderWithProviders(<RecentSessions />);

    const [active, finished] = await screen.findAllByRole('listitem');

    expect(within(active!).getByText(status.active)).toBeInTheDocument();
    expect(within(active!).getByText(text.continue)).toBeInTheDocument();
    expect(within(active!).getByText(/13 лист\. 2026/)).toBeInTheDocument();
    expect(within(finished!).getByText(status.finished)).toBeInTheDocument();
    expect(
      within(finished!).queryByText(text.continue),
    ).not.toBeInTheDocument();
    expect(within(finished!).getByText(/12 лист\. 2026/)).toBeInTheDocument();
  });

  it('[TC-03-03] marks only suggested topics as English', async () => {
    stubSessions([ACTIVE, testSession({ ...FINISHED, topicSource: 'custom' })]);
    renderWithProviders(<RecentSessions />);

    await screen.findAllByRole('listitem');

    expect(screen.getByText(ACTIVE.topic)).toHaveAttribute('lang', 'en');
    expect(screen.getByText(FINISHED.topic)).not.toHaveAttribute('lang');
  });
});
