import { screen } from '@testing-library/react';
import { uk } from '@/shared/i18n/resources';
import { mockApi } from '@/shared/testing/mock-api';
import { jsonResponse } from '@/shared/testing/http-responses';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { HomePage } from './HomePage';

describe('HomePage', () => {
  it('[TC-03-06] offers the start button as a link to the proposal before the list loads', () => {
    mockApi({ 'GET /api/sessions': jsonResponse([]) });
    renderWithProviders(<HomePage />);

    expect(
      screen.getByRole('link', { name: uk.session.home.start }),
    ).toHaveAttribute('href', '/sessions/new');
    expect(
      screen.getByRole('status', { name: uk.common.loading }),
    ).toBeInTheDocument();
  });

  it('[TC-03-06] keeps the page title', async () => {
    mockApi({ 'GET /api/sessions': jsonResponse([]) });
    renderWithProviders(<HomePage />);

    expect(
      screen.getByRole('heading', { level: 1, name: uk.pages.session.title }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(uk.session.home.recent.empty),
    ).toBeInTheDocument();
  });
});
