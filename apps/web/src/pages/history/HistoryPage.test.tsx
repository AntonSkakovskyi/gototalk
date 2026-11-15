import { screen } from '@testing-library/react';
import uk from '@/shared/i18n/uk.json';
import { mockApi } from '@/shared/testing/mock-api';
import { jsonResponse } from '@/shared/testing/http-responses';
import { testSession } from '@/shared/testing/fixtures/session';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { HistoryPage } from './HistoryPage';

describe('HistoryPage', () => {
  it('[TC-05-03] shows the page title and the session history under it', async () => {
    mockApi({
      'GET /api/sessions/history': jsonResponse({
        items: [testSession({ topic: 'My hometown', status: 'finished' })],
        nextCursor: null,
      }),
    });
    renderWithProviders(<HistoryPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: uk.pages.history.title }),
    ).toBeInTheDocument();
    expect(await screen.findByText('My hometown')).toBeInTheDocument();
  });
});
