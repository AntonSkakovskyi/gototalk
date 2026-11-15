import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { uk } from '@/shared/i18n/resources';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { LoadMoreFooter } from './LoadMoreFooter';

function renderFooter(props: Partial<ComponentProps<typeof LoadMoreFooter>>) {
  const onLoadMore = vi.fn();
  renderWithProviders(
    <LoadMoreFooter
      loadedText="Loaded: 2"
      loadMoreLabel="Load more"
      errorMessage="Next page failed"
      hasNextPage
      isFetchingNextPage={false}
      isFetchNextPageError={false}
      onLoadMore={onLoadMore}
      {...props}
    />,
  );
  return onLoadMore;
}

const loadMore = () => screen.queryByRole('button', { name: 'Load more' });

describe('LoadMoreFooter', () => {
  it('[TC-05-05] announces the loaded text in a polite live region', () => {
    renderFooter({});

    expect(
      screen.getByText('Loaded: 2').closest('[aria-live]'),
    ).toHaveAttribute('aria-live', 'polite');
  });

  it('[TC-05-05] calls onLoadMore from the button', async () => {
    const user = userEvent.setup();
    const onLoadMore = renderFooter({});

    await user.click(loadMore()!);

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('[TC-05-05] disables the button while the next page is fetched', () => {
    renderFooter({ isFetchingNextPage: true });

    expect(loadMore()).toBeDisabled();
  });

  it('[TC-05-05] hides the button on the last page', () => {
    renderFooter({ hasNextPage: false });

    expect(loadMore()).not.toBeInTheDocument();
  });

  it('[TC-05-05] replaces the button with an error and a retry that loads the next page', async () => {
    const user = userEvent.setup();
    const onLoadMore = renderFooter({ isFetchNextPageError: true });

    expect(screen.getByRole('alert')).toHaveTextContent('Next page failed');
    expect(loadMore()).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: uk.common.actions.retry }),
    );

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('[TC-05-05] shows no error while a retry is in flight', () => {
    renderFooter({ isFetchNextPageError: true, isFetchingNextPage: true });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(loadMore()).toBeDisabled();
  });
});
