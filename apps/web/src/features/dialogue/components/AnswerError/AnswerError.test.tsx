import { ERROR_CODES } from '@gototalk/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/shared/api/http';
import { uk } from '@/shared/i18n/resources';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { AnswerError } from './AnswerError';

const STT_DOWN = new ApiError(
  503,
  ERROR_CODES.SPEECH_RECOGNITION_UNAVAILABLE,
  'down',
);

describe('AnswerError', () => {
  it('[TC-04-08] renders nothing without an error', () => {
    renderWithProviders(<AnswerError error={null} onRetry={vi.fn()} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('[TC-04-08] announces the mapped message and offers the generic retry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderWithProviders(<AnswerError error={STT_DOWN} onRetry={onRetry} />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      uk.dialogue.errors.speechUnavailable,
    );
    await user.click(
      screen.getByRole('button', { name: uk.common.actions.retry }),
    );

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('[TC-04-08] uses the given retry label for resending a recording', () => {
    renderWithProviders(
      <AnswerError
        error={STT_DOWN}
        onRetry={vi.fn()}
        retryLabel={uk.dialogue.voice.resend}
      />,
    );

    expect(
      screen.getByRole('button', { name: uk.dialogue.voice.resend }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: uk.common.actions.retry }),
    ).not.toBeInTheDocument();
  });

  it.each([
    [413, ERROR_CODES.AUDIO_TOO_LARGE, uk.dialogue.errors.audioTooLarge],
    [415, ERROR_CODES.AUDIO_UNSUPPORTED, uk.dialogue.errors.audioUnsupported],
    [422, ERROR_CODES.TRANSCRIPT_EMPTY, uk.dialogue.errors.transcriptEmpty],
  ])(
    '[TC-04-08] shows the %i message without a retry',
    (status, code, text) => {
      renderWithProviders(
        <AnswerError error={new ApiError(status, code, 'x')} />,
      );

      expect(screen.getByRole('alert')).toHaveTextContent(text);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    },
  );
});
