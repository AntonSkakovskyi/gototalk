import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App.js';
import uk from './i18n/uk.json';
import { renderWithProviders } from './test-utils.js';

describe('App', () => {
  it('[TC-00-04] рендерить кореневий елемент застосунку', () => {
    renderWithProviders(<App />);

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('[TC-00-02] показує вкладки нижньої навігації українською', () => {
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

  it('[TC-00-02] індекс відкриває сторінку «Сесія», вкладка активна', () => {
    renderWithProviders(<App />);

    expect(
      screen.getByRole('heading', { level: 1, name: uk.pages.session.title }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: uk.nav.session })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('[TC-00-02] клік по вкладці перемикає маршрут', async () => {
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

  it('[TC-00-02] прямий перехід на маршрут відкриває відповідну сторінку', () => {
    renderWithProviders(<App />, { route: '/history' });

    expect(
      screen.getByRole('heading', { level: 1, name: uk.pages.history.title }),
    ).toBeInTheDocument();
  });

  it('[TC-00-02] невідомий шлях перенаправляє на «Сесія»', () => {
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
