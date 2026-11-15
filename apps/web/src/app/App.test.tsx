import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import uk from '@/shared/i18n/uk.json';
import { mockApi } from '@/shared/testing/mock-api';
import {
  EMPTY_SESSIONS_ROUTE,
  jsonResponse,
} from '@/shared/testing/http-responses';
import { TEST_PROFILE } from '@/shared/testing/fixtures/profile';
import { TEST_USER } from '@/shared/testing/fixtures/auth';
import { renderWithProviders } from '@/shared/testing/test-utils';

const SESSION = {
  accessToken: 'access-1',
  user: { ...TEST_USER, consentAt: '2026-01-01T10:00:00.000Z' },
};

beforeEach(() => {
  mockApi({
    'GET /api/profile': jsonResponse(TEST_PROFILE),
    ...EMPTY_SESSIONS_ROUTE,
  });
});

describe('App', () => {
  it('[TC-00-04] renders the root element of the app', async () => {
    renderWithProviders(<App />, { session: SESSION });

    expect(
      await screen.findByRole('heading', { level: 1 }),
    ).toBeInTheDocument();
  });

  it('[TC-00-02] shows the bottom navigation tabs in Ukrainian', async () => {
    renderWithProviders(<App />, { session: SESSION });

    const nav = await screen.findByRole('navigation');
    const labels = within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent);

    expect(labels).toEqual(['Сесія', 'Слова', 'Історія', 'Профіль']);
    expect(labels).toEqual([
      uk.nav.session,
      uk.nav.words,
      uk.nav.history,
      uk.nav.profile,
    ]);
  });

  it('[TC-00-02] index opens the Session page and its tab is active', async () => {
    renderWithProviders(<App />, { session: SESSION });

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: uk.pages.session.title,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: uk.nav.session })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('[TC-00-02] clicking a tab switches the route', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { session: SESSION });
    await screen.findByRole('navigation');

    const tabs = [
      { nav: uk.nav.words, title: uk.pages.words.title },
      { nav: uk.nav.history, title: uk.pages.history.title },
      { nav: uk.nav.profile, title: uk.pages.profile.title },
      { nav: uk.nav.session, title: uk.pages.session.title },
    ];

    for (const { nav, title } of tabs) {
      await user.click(screen.getByRole('link', { name: nav }));

      expect(
        screen.getByRole('heading', { level: 1, name: title }),
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: nav })).toHaveAttribute(
        'aria-current',
        'page',
      );
    }
  });

  it('[TC-00-02] direct navigation to a route opens the matching page', async () => {
    renderWithProviders(<App />, { route: '/history', session: SESSION });

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: uk.pages.history.title,
      }),
    ).toBeInTheDocument();
  });

  it('[TC-00-02] unknown path redirects to Session', async () => {
    renderWithProviders(<App />, { route: '/no-such-page', session: SESSION });

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: uk.pages.session.title,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: uk.nav.session })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
