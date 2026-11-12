import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App.js';
import uk from './i18n/uk.json';
import { renderWithProviders } from './test-utils.js';

describe('App', () => {
  it('[TC-00-04] renders the root element of the app', () => {
    renderWithProviders(<App />);

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('[TC-00-02] shows the bottom navigation tabs in Ukrainian', () => {
    renderWithProviders(<App />);

    const nav = screen.getByRole('navigation');
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

  it('[TC-00-02] index opens the Session page and its tab is active', () => {
    renderWithProviders(<App />);

    expect(
      screen.getByRole('heading', { level: 1, name: uk.pages.session.title }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: uk.nav.session })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('[TC-00-02] clicking a tab switches the route', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

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

  it('[TC-00-02] direct navigation to a route opens the matching page', () => {
    renderWithProviders(<App />, { route: '/history' });

    expect(
      screen.getByRole('heading', { level: 1, name: uk.pages.history.title }),
    ).toBeInTheDocument();
  });

  it('[TC-00-02] unknown path redirects to Session', () => {
    renderWithProviders(<App />, { route: '/no-such-page' });

    expect(
      screen.getByRole('heading', { level: 1, name: uk.pages.session.title }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: uk.nav.session })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
