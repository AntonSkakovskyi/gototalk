import { MAX_RECORDING_SECONDS } from '@gototalk/shared';
import { screen } from '@testing-library/react';
import type { RecorderStatus } from '@/features/dialogue/hooks/use-audio-recorder';
import uk from '@/shared/i18n/uk.json';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { RecordingIndicator } from './RecordingIndicator';

function renderIndicator(
  status: RecorderStatus,
  elapsedSeconds = 0,
  level = 0,
) {
  return renderWithProviders(
    <RecordingIndicator
      status={status}
      elapsedSeconds={elapsedSeconds}
      level={level}
    />,
  );
}

describe('RecordingIndicator', () => {
  it.each(['idle', 'denied', 'unsupported', 'error'] as const)(
    '[TC-04-05] keeps an empty polite live region while %s',
    (status) => {
      const { container } = renderIndicator(status);

      const region = container.querySelector('[aria-live="polite"]');
      expect(region).toBeInTheDocument();
      expect(region).toBeEmptyDOMElement();
      expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    },
  );

  it('[TC-04-05] announces the wait for the microphone permission', () => {
    const { container } = renderIndicator('requesting');

    const text = screen.getByText(uk.dialogue.voice.indicator.requesting);
    expect(container.querySelector('[aria-live="polite"]')).toContainElement(
      text,
    );
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  });

  it('[TC-04-05] announces the recording state and shows the elapsed time against the limit', () => {
    const { container } = renderIndicator('recording', 75);

    const label = screen.getByText(uk.dialogue.voice.indicator.recording);
    expect(container.querySelector('[aria-live="polite"]')).toContainElement(
      label,
    );
    const timer = screen.getByRole('timer', {
      name: uk.dialogue.voice.indicator.timerLabel,
    });
    expect(timer).toHaveTextContent('1:15 / 2:00');
    expect(MAX_RECORDING_SECONDS).toBe(120);
  });

  it('[TC-04-05] keeps the timer outside the live region so every second is not announced', () => {
    const { container } = renderIndicator('recording', 5);

    expect(
      container.querySelector('[aria-live="polite"]'),
    ).not.toContainElement(screen.getByRole('timer'));
  });

  it('[TC-04-05] hides the level meter from assistive technology', () => {
    const { container } = renderIndicator('recording', 3, 0.5);

    const meter = container.querySelector('[role="progressbar"]');
    expect(meter).toBeInTheDocument();
    expect(meter?.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it.each([
    [0, 0],
    [0.1, 30],
    [0.5, 100],
    [1, 100],
  ])(
    '[TC-04-05] shows input level %f as a %i percent meter',
    (level, percent) => {
      const { container } = renderIndicator('recording', 3, level);

      const meter = container.querySelector('[role="progressbar"]');
      expect(Number(meter?.getAttribute('aria-valuenow'))).toBeCloseTo(percent);
    },
  );
});
