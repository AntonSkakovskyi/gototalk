import { screen } from '@testing-library/react';
import { uk } from '@/shared/i18n/resources';
import { mockApi } from '@/shared/testing/mock-api';
import { jsonResponse } from '@/shared/testing/http-responses';
import { testWord } from '@/shared/testing/fixtures/words';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { WordsPage } from './WordsPage';

describe('WordsPage', () => {
  it('[TC-05-05] shows the page title and the word list under it', async () => {
    mockApi({
      'GET /api/words': jsonResponse({
        items: [testWord({ lemma: 'schedule' })],
        nextCursor: null,
      }),
    });
    renderWithProviders(<WordsPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: uk.pages.words.title }),
    ).toBeInTheDocument();
    expect(await screen.findByText('schedule')).toBeInTheDocument();
  });
});
