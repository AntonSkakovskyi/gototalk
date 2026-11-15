import type { Session, SessionPage } from '@gototalk/shared';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { sessionKeys } from '@/entities/session/api/session-details';
import uk from '@/shared/i18n/uk.json';
import { deferred } from '@/shared/testing/deferred';
import { mockApi } from '@/shared/testing/mock-api';
import { createTestQueryClient } from '@/shared/testing/query-wrapper';
import { errorResponse, jsonResponse } from '@/shared/testing/http-responses';
import { testSession } from '@/shared/testing/fixtures/session';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { SessionHistory } from './SessionHistory';

const text = uk.session.history;
const FIRST_ROUTE = 'GET /api/sessions/history';
const NEXT_ROUTE = 'GET /api/sessions/history?cursor=c1';

function sessionNumber(n: number, overrides: Partial<Session> = {}): Session {
  return testSession({
    id: `7c2e8b64-5f0a-4d1b-8e3a-2a9b4c6d${String(n).padStart(4, '0')}`,
    topic: `Topic ${n}`,
    status: 'finished',
    endedAt: '2026-11-12T12:20:00.000Z',
    ...overrides,
  });
}

const ACTIVE = sessionNumber(1, { status: 'active', endedAt: null });
const FINISHED = sessionNumber(2);
const OLDER = sessionNumber(3);

const FIRST_PAGE: SessionPage = {
  items: [ACTIVE, FINISHED],
  nextCursor: 'c1',
};
const LAST_PAGE: SessionPage = { items: [OLDER], nextCursor: null };

const loadMore = () => screen.queryByRole('button', { name: text.loadMore });

function loaded(count: number, form: 'few' | 'many' | 'one' | 'other') {
  return text[`loaded_${form}`].replace('{{count}}', String(count));
}

describe('SessionHistory', () => {
  it('[TC-05-03] announces loading and then lists the first page with a load-more button', async () => {
    mockApi({ [FIRST_ROUTE]: jsonResponse(FIRST_PAGE) });
    renderWithProviders(<SessionHistory />);

    expect(
      screen.getByRole('status', { name: uk.common.loading }),
    ).toBeInTheDocument();
    expect(await screen.findByText(ACTIVE.topic)).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(loadMore()).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('[TC-05-03] links an active session to the dialogue and a finished one to the report', async () => {
    mockApi({ [FIRST_ROUTE]: jsonResponse(FIRST_PAGE) });
    renderWithProviders(<SessionHistory />);

    const [active, finished] = await screen.findAllByRole('listitem');

    expect(
      within(active!).getByRole('link', { name: /Topic 1/ }),
    ).toHaveAttribute('href', `/sessions/${ACTIVE.id}`);
    expect(
      within(finished!).getByRole('link', { name: /Topic 2/ }),
    ).toHaveAttribute('href', `/sessions/${FINISHED.id}/report`);
  });

  it('[TC-05-03] requests the next page with the cursor, appends it and hides the button on the last page', async () => {
    const user = userEvent.setup();
    const { requests } = mockApi({
      [FIRST_ROUTE]: jsonResponse(FIRST_PAGE),
      [NEXT_ROUTE]: jsonResponse(LAST_PAGE),
    });
    renderWithProviders(<SessionHistory />);
    await screen.findByText(ACTIVE.topic);

    await user.click(loadMore()!);

    expect(await screen.findByText(OLDER.topic)).toBeInTheDocument();
    expect(
      screen.getAllByRole('listitem').map((item) => item.textContent),
    ).toEqual([
      expect.stringContaining('Topic 1'),
      expect.stringContaining('Topic 2'),
      expect.stringContaining('Topic 3'),
    ]);
    expect(requests.map((request) => request.path)).toEqual([
      '/api/sessions/history',
      '/api/sessions/history?cursor=c1',
    ]);
    expect(loadMore()).not.toBeInTheDocument();
  });

  it('[TC-05-03] shows no load-more button when the only page is the last', async () => {
    mockApi({ [FIRST_ROUTE]: jsonResponse(LAST_PAGE) });
    renderWithProviders(<SessionHistory />);

    await screen.findByText(OLDER.topic);

    expect(loadMore()).not.toBeInTheDocument();
  });

  it('[TC-05-03] disables the button while the next page is fetched', async () => {
    const user = userEvent.setup();
    const next = deferred();
    mockApi({
      [FIRST_ROUTE]: jsonResponse(FIRST_PAGE),
      [NEXT_ROUTE]: () => next.promise,
    });
    renderWithProviders(<SessionHistory />);
    await screen.findByText(ACTIVE.topic);

    await user.click(loadMore()!);

    expect(loadMore()).toBeDisabled();
    await act(async () => next.resolve(jsonResponse(LAST_PAGE)));
    expect(await screen.findByText(OLDER.topic)).toBeInTheDocument();
  });

  it('[TC-05-03] announces the number of loaded sessions in a polite live region', async () => {
    const user = userEvent.setup();
    mockApi({
      [FIRST_ROUTE]: jsonResponse(FIRST_PAGE),
      [NEXT_ROUTE]: jsonResponse(LAST_PAGE),
    });
    renderWithProviders(<SessionHistory />);

    const region = await screen.findByText(loaded(2, 'few'));
    expect(region.closest('[aria-live]')).toHaveAttribute(
      'aria-live',
      'polite',
    );

    await user.click(loadMore()!);

    expect(await screen.findByText(loaded(3, 'few'))).toBeInTheDocument();
  });

  it('[TC-05-03] explains the empty state and offers to start a session', async () => {
    mockApi({ [FIRST_ROUTE]: jsonResponse({ items: [], nextCursor: null }) });
    renderWithProviders(<SessionHistory />);

    expect(await screen.findByText(text.empty)).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(loadMore()).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: text.startSession }),
    ).toHaveAttribute('href', '/sessions/new');
  });

  it('[TC-05-03] shows an error with retry and recovers on retry', async () => {
    const user = userEvent.setup();
    let failing = true;
    mockApi({
      [FIRST_ROUTE]: () =>
        failing
          ? errorResponse(500, 'INTERNAL_ERROR')
          : jsonResponse(FIRST_PAGE),
    });
    renderWithProviders(<SessionHistory />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.errors.generic,
    );
    expect(screen.queryByRole('list')).not.toBeInTheDocument();

    failing = false;
    await user.click(
      screen.getByRole('button', { name: uk.common.actions.retry }),
    );

    expect(await screen.findByText(ACTIVE.topic)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('[TC-05-03] keeps the loaded sessions when the next page fails and retries without reloading the first page', async () => {
    const user = userEvent.setup();
    let failing = true;
    const { requests } = mockApi({
      [FIRST_ROUTE]: jsonResponse(FIRST_PAGE),
      [NEXT_ROUTE]: () =>
        failing
          ? errorResponse(500, 'INTERNAL_ERROR')
          : jsonResponse(LAST_PAGE),
    });
    renderWithProviders(<SessionHistory />);
    await screen.findByText(ACTIVE.topic);

    await user.click(loadMore()!);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      text.loadMoreError,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);

    failing = false;
    await user.click(
      screen.getByRole('button', { name: uk.common.actions.retry }),
    );

    expect(await screen.findByText(OLDER.topic)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(
      requests.filter((request) => !request.path.includes('cursor')),
    ).toHaveLength(1);
  });

  it('[TC-05-03] refetches when the history key is invalidated', async () => {
    const queryClient = createTestQueryClient();
    let page: SessionPage = LAST_PAGE;
    mockApi({ [FIRST_ROUTE]: () => jsonResponse(page) });
    renderWithProviders(<SessionHistory />, { queryClient });
    await screen.findByText(OLDER.topic);

    page = { items: [ACTIVE, OLDER], nextCursor: null };
    await act(() =>
      queryClient.invalidateQueries({ queryKey: sessionKeys.history() }),
    );

    expect(await screen.findByText(ACTIVE.topic)).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});
