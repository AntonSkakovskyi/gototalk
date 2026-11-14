import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import uk from '@/shared/i18n/uk.json';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { RecordButton } from './RecordButton';

function renderButton(props: Partial<Parameters<typeof RecordButton>[0]> = {}) {
  const onStart = vi.fn();
  const onStop = vi.fn();
  renderWithProviders(
    <RecordButton
      recording={false}
      disabled={false}
      onStart={onStart}
      onStop={onStop}
      {...props}
    />,
  );
  return { onStart, onStop };
}

describe('RecordButton', () => {
  it('[TC-04-05] offers to record and is not pressed while idle', () => {
    renderButton();

    const button = screen.getByRole('button', {
      name: uk.dialogue.voice.record,
    });
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('[TC-04-14] switches to a different label and a pressed state while recording', () => {
    renderButton({ recording: true });

    const button = screen.getByRole('button', { name: uk.dialogue.voice.stop });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.queryByRole('button', { name: uk.dialogue.voice.record }),
    ).not.toBeInTheDocument();
  });

  it('[TC-04-05] starts on click', async () => {
    const user = userEvent.setup();
    const { onStart, onStop } = renderButton();

    await user.click(screen.getByRole('button'));
    expect(onStart).toHaveBeenCalledOnce();
    expect(onStop).not.toHaveBeenCalled();
  });

  it('[TC-04-05] stops while recording', async () => {
    const user = userEvent.setup();
    const { onStart, onStop } = renderButton({ recording: true });

    await user.click(screen.getByRole('button'));

    expect(onStop).toHaveBeenCalledOnce();
    expect(onStart).not.toHaveBeenCalled();
  });

  it.each([['{Enter}'], [' ']])(
    '[TC-04-05] is operable from the keyboard with %j',
    async (key) => {
      const user = userEvent.setup();
      const { onStart } = renderButton();

      await user.tab();
      expect(screen.getByRole('button')).toHaveFocus();
      await user.keyboard(key);

      expect(onStart).toHaveBeenCalledOnce();
    },
  );

  it('[TC-04-05] does nothing while disabled', async () => {
    const user = userEvent.setup();
    const { onStart } = renderButton({ disabled: true });

    await user.click(screen.getByRole('button'));

    expect(screen.getByRole('button')).toBeDisabled();
    expect(onStart).not.toHaveBeenCalled();
  });
});
