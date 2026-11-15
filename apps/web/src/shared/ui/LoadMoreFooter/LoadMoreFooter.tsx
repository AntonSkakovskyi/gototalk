import { Button, Stack, Text } from '@mantine/core';
import { LoadError } from '@/shared/ui/LoadError/LoadError';

interface LoadMoreFooterProps {
  loadedText: string;
  loadMoreLabel: string;
  errorMessage: string;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  onLoadMore: () => void;
}

export function LoadMoreFooter({
  loadedText,
  loadMoreLabel,
  errorMessage,
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
  onLoadMore,
}: LoadMoreFooterProps) {
  const failed = isFetchNextPageError && !isFetchingNextPage;

  return (
    <Stack gap="md">
      <div aria-live="polite">
        <Text size="sm" c="dimmed">
          {loadedText}
        </Text>
      </div>
      {failed && <LoadError message={errorMessage} onRetry={onLoadMore} />}
      {hasNextPage && !failed && (
        <Button
          size="lg"
          variant="light"
          fullWidth
          loading={isFetchingNextPage}
          disabled={isFetchingNextPage}
          onClick={onLoadMore}
        >
          {loadMoreLabel}
        </Button>
      )}
    </Stack>
  );
}
