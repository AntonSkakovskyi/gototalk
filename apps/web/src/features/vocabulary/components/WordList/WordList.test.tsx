import type { Word, WordPage } from '@gototalk/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { uk } from '@/shared/i18n/resources';
import { mockApi } from '@/shared/testing/mock-api';
import { errorResponse, jsonResponse } from '@/shared/testing/http-responses';
import { testWord } from '@/shared/testing/fixtures/words';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { mockWordsApi } from '@/features/vocabulary/testing/words-mocks';
import { WordList } from './WordList';

const text = uk.vocabulary.list;
const marks = uk.vocabulary.marks;
const FIRST_ROUTE = 'GET /api/words';
const NEXT_ROUTE = 'GET /api/words?cursor=c1';

function wordNumber(n: number, overrides: Partial<Word> = {}): Word {
  return testWord({
    id: `4a8d3e27-1b5c-4c9d-9e6f-7a2b8c1d${String(n).padStart(4, '0')}`,
    lemma: `word${n}`,
    translationUk: `слово${n}`,
    ...overrides,
  });
}

const NEWEST = wordNumber(1);
const MIDDLE = wordNumber(2, { state: 'partial' });
const OLDEST = wordNumber(3, { state: 'passive', translationUk: null });

const FIRST_PAGE: WordPage = { items: [NEWEST, MIDDLE], nextCursor: 'c1' };
const LAST_PAGE: WordPage = { items: [OLDEST], nextCursor: null };

const loadMore = () => screen.queryByRole('button', { name: text.loadMore });

function loaded(count: number, form: 'few' | 'many' | 'one' | 'other') {
  return text[`loaded_${form}`].replace('{{count}}', String(count));
}

describe('WordList', () => {
  it('[TC-05-05] announces loading and then lists the first page in server order with a load-more button', async () => {
    mockApi({ [FIRST_ROUTE]: jsonResponse(FIRST_PAGE) });
    renderWithProviders(<WordList />);

    expect(
      screen.getByRole('status', { name: uk.common.loading }),
    ).toBeInTheDocument();
    expect(await screen.findByText('word1')).toBeInTheDocument();
    expect(
      screen.getAllByRole('listitem').map((item) => item.textContent),
    ).toEqual([
      expect.stringContaining('word1'),
      expect.stringContaining('word2'),
    ]);
    expect(loadMore()).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('[TC-05-05] shows the lemma as English text, the translation when present and the marks', async () => {
    mockApi({
      [FIRST_ROUTE]: jsonResponse({
        items: [NEWEST, OLDEST],
        nextCursor: null,
      }),
    });
    renderWithProviders(<WordList />);

    const [first, last] = await screen.findAllByRole('listitem');

    expect(within(first!).getByText('word1')).toHaveAttribute('lang', 'en');
    expect(within(first!).getByText('слово1')).toBeInTheDocument();
    expect(within(first!).getByRole('radiogroup')).toBeInTheDocument();
    expect(within(last!).getByText('word3')).toBeInTheDocument();
    expect(within(last!).queryByText(/слово/)).not.toBeInTheDocument();
  });

  it.each([
    ['new', text.state.new, marks.new],
    ['partial', text.state.partial, marks.partial],
    ['passive', text.state.passive, marks.passive],
  ] as const)(
    '[TC-05-05] labels a %s word with its state and checks that mark',
    async (state, label, mark) => {
      mockApi({
        [FIRST_ROUTE]: jsonResponse({
          items: [wordNumber(1, { state })],
          nextCursor: null,
        }),
      });
      renderWithProviders(<WordList />);

      const item = (await screen.findAllByRole('listitem'))[0]!;

      expect(within(item).getByText(label)).toBeInTheDocument();
      expect(within(item).getByRole('radio', { name: mark })).toBeChecked();
    },
  );

  it('[TC-05-05] shows an active word with its state label and the badge but no controls', async () => {
    mockApi({
      [FIRST_ROUTE]: jsonResponse({
        items: [wordNumber(1, { state: 'active' })],
        nextCursor: null,
      }),
    });
    renderWithProviders(<WordList />);

    const item = (await screen.findAllByRole('listitem'))[0]!;

    expect(within(item).getByText(text.state.active)).toBeInTheDocument();
    expect(
      within(item).getByText(uk.vocabulary.activeBadge),
    ).toBeInTheDocument();
    expect(within(item).queryByRole('radio')).not.toBeInTheDocument();
  });

  it('[TC-05-05] requests the next page with the cursor, appends it and hides the button on the last page', async () => {
    const user = userEvent.setup();
    const { requests } = mockApi({
      [FIRST_ROUTE]: jsonResponse(FIRST_PAGE),
      [NEXT_ROUTE]: jsonResponse(LAST_PAGE),
    });
    renderWithProviders(<WordList />);
    await screen.findByText('word1');

    await user.click(loadMore()!);

    expect(await screen.findByText('word3')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(requests.map((request) => request.path)).toEqual([
      '/api/words',
      '/api/words?cursor=c1',
    ]);
    expect(loadMore()).not.toBeInTheDocument();
  });

  it('[TC-05-05] announces the number of loaded words in a polite live region', async () => {
    const user = userEvent.setup();
    mockApi({
      [FIRST_ROUTE]: jsonResponse(FIRST_PAGE),
      [NEXT_ROUTE]: jsonResponse(LAST_PAGE),
    });
    renderWithProviders(<WordList />);

    const region = await screen.findByText(loaded(2, 'few'));
    expect(region.closest('[aria-live]')).toHaveAttribute(
      'aria-live',
      'polite',
    );

    await user.click(loadMore()!);

    expect(await screen.findByText(loaded(3, 'few'))).toBeInTheDocument();
  });

  it('[TC-05-05] explains the empty state', async () => {
    mockApi({ [FIRST_ROUTE]: jsonResponse({ items: [], nextCursor: null }) });
    renderWithProviders(<WordList />);

    expect(await screen.findByText(text.empty)).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(loadMore()).not.toBeInTheDocument();
  });

  it('[TC-05-07] shows an error with retry and recovers on retry', async () => {
    const user = userEvent.setup();
    let failing = true;
    mockApi({
      [FIRST_ROUTE]: () =>
        failing
          ? errorResponse(500, 'INTERNAL_ERROR')
          : jsonResponse(FIRST_PAGE),
    });
    renderWithProviders(<WordList />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.errors.generic,
    );
    expect(screen.queryByRole('list')).not.toBeInTheDocument();

    failing = false;
    await user.click(
      screen.getByRole('button', { name: uk.common.actions.retry }),
    );

    expect(await screen.findByText('word1')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('[TC-05-07] keeps the loaded words when the next page fails and retries without reloading the first page', async () => {
    const user = userEvent.setup();
    let failing = true;
    const { requests } = mockApi({
      [FIRST_ROUTE]: jsonResponse(FIRST_PAGE),
      [NEXT_ROUTE]: () =>
        failing
          ? errorResponse(500, 'INTERNAL_ERROR')
          : jsonResponse(LAST_PAGE),
    });
    renderWithProviders(<WordList />);
    await screen.findByText('word1');

    await user.click(loadMore()!);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      text.loadMoreError,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);

    failing = false;
    await user.click(
      screen.getByRole('button', { name: uk.common.actions.retry }),
    );

    expect(await screen.findByText('word3')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(
      requests.filter((request) => !request.path.includes('cursor')),
    ).toHaveLength(1);
  });

  it('[TC-05-05] marking a word sends the PATCH and shows the new state', async () => {
    const user = userEvent.setup();
    let current = [NEWEST, MIDDLE];
    const api = mockWordsApi({
      words: current,
      mark: (id, body) => {
        current = current.map((word) =>
          word.id === id ? { ...word, state: body.state } : word,
        );
        return jsonResponse(current.find((word) => word.id === id));
      },
      extraRoutes: {
        [FIRST_ROUTE]: () => jsonResponse({ items: current, nextCursor: null }),
      },
    });
    renderWithProviders(<WordList />);
    const item = (await screen.findAllByRole('listitem'))[0]!;
    expect(within(item).getByText(text.state.new)).toBeInTheDocument();

    await user.click(within(item).getByRole('radio', { name: marks.passive }));

    expect(
      await within(item).findByText(text.state.passive),
    ).toBeInTheDocument();
    expect(
      within(item).getByRole('radio', { name: marks.passive }),
    ).toBeChecked();
    expect(api.markRequests()).toEqual([
      { id: NEWEST.id, body: { state: 'passive' } },
    ]);
  });
});
