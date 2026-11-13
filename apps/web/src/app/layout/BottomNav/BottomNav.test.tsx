import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BottomNav } from './BottomNav';
import uk from '@/shared/i18n/uk.json';
import { renderWithProviders } from '@/shared/testing/test-utils';

function renderNav() {
  renderWithProviders(<BottomNav />);
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

  it('[TC-00-02] makes every tab reachable with the keyboard', async () => {
    const user = userEvent.setup();
    const nav = renderNav();

    for (const link of within(nav).getAllByRole('link')) {
      await user.tab();
      expect(link).toHaveFocus();
    }
  });
});
