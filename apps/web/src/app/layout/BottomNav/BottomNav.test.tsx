import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BottomNav } from './BottomNav';
import uk from '@/shared/i18n/uk.json';
import { renderWithProviders } from '@/shared/testing/test-utils';

function renderNav(route = '/') {
  renderWithProviders(<BottomNav />, { route });
  return screen.getByRole('navigation', { name: uk.nav.label });
}

describe('BottomNav', () => {
  it('[TC-00-02] renders four tab links with Ukrainian names', () => {
    const links = within(renderNav()).getAllByRole('link');

    expect(links.map((link) => link.textContent)).toEqual([
      uk.nav.session,
      uk.nav.words,
      uk.nav.history,
      uk.nav.profile,
    ]);
  });

  it('[TC-00-02] marks only the current tab and moves the mark after a click', async () => {
    const user = userEvent.setup();
    const nav = renderNav();

    expect(within(nav).getByRole('link', { name: uk.nav.session })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await user.click(within(nav).getByRole('link', { name: uk.nav.words }));

    expect(within(nav).getByRole('link', { name: uk.nav.words })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      within(nav).getByRole('link', { name: uk.nav.session }),
    ).not.toHaveAttribute('aria-current');
    expect(within(nav).getAllByRole('link', { current: 'page' })).toHaveLength(1);
  });

  it.each([
    '/',
    '/sessions/new',
    '/sessions/0f8fad5b-d9cb-469f-a165-70867728950e',
    '/sessions/0f8fad5b-d9cb-469f-a165-70867728950e/report',
  ])(
    '[TC-03-03] marks the session tab as current on %s',
    (route) => {
      const nav = renderNav(route);

      expect(within(nav).getAllByRole('link', { current: 'page' })).toEqual([
        within(nav).getByRole('link', { name: uk.nav.session }),
      ]);
    },
  );

  it.each(['/words', '/history', '/profile'])(
    '[TC-03-03] does not mark the session tab as current on %s',
    (route) => {
      const nav = renderNav(route);

      expect(
        within(nav).getByRole('link', { name: uk.nav.session }),
      ).not.toHaveAttribute('aria-current');
    },
  );

  it('[TC-00-02] makes every tab reachable with the keyboard', async () => {
    const user = userEvent.setup();
    const nav = renderNav();

    for (const link of within(nav).getAllByRole('link')) {
      await user.tab();
      expect(link).toHaveFocus();
    }
  });
});
