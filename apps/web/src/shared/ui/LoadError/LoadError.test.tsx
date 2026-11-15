import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import uk from '@/shared/i18n/uk.json';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { LoadError } from '@/shared/ui/LoadError/LoadError';

describe('LoadError', () => {
  it('[TC-03-03] shows the generic error and a retry button that calls onRetry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderWithProviders(<LoadError onRetry={onRetry} />);

    expect(screen.getByRole('alert')).toHaveTextContent(uk.errors.generic);

    await user.click(
      screen.getByRole('button', { name: uk.common.actions.retry }),
    );

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('[TC-05-07] shows a given message instead of the generic one', () => {
    renderWithProviders(<LoadError onRetry={vi.fn()} message="Custom text" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Custom text');
    expect(screen.getByRole('alert')).not.toHaveTextContent(uk.errors.generic);
  });
});
