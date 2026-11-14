import { screen } from '@testing-library/react';
import type { AnswerPhase } from '@/features/dialogue/hooks/use-answer-flow';
import uk from '@/shared/i18n/uk.json';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { ProcessingStatus } from './ProcessingStatus';

function renderStatus(phase: AnswerPhase) {
  return renderWithProviders(<ProcessingStatus phase={phase} />);
}

describe('ProcessingStatus', () => {
  it('[TC-04-12] keeps an empty polite live region while idle', () => {
    const { container } = renderStatus('idle');

    const region = container.querySelector('[aria-live="polite"]');
    expect(region).toBeInTheDocument();
    expect(region).toBeEmptyDOMElement();
  });

  it.each([
    ['sending', uk.dialogue.status.sending],
    ['recognizing', uk.dialogue.status.recognizing],
    ['analyzing', uk.dialogue.status.analyzing],
  ] as const)('[TC-04-12] announces the %s phase', (phase, text) => {
    const { container } = renderStatus(phase);

    expect(screen.getByText(text)).toBeInTheDocument();
    expect(container.querySelector('[aria-live="polite"]')).toContainElement(
      screen.getByText(text),
    );
  });
});
