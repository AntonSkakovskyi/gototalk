import { ERROR_CODES } from '@gototalk/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import uk from '@/shared/i18n/uk.json';
import {
  analysisOk,
  mockDialogueApi,
} from '@/features/dialogue/testing/dialogue-mocks';
import { errorResponse } from '@/shared/testing/http-responses';
import { testSessionDetails } from '@/shared/testing/fixtures/session';
import {
  FIRST_QUESTION,
  PENDING_ANSWER,
  REPLY,
  currentCard,
  currentCardElement,
  renderScreen,
} from '@/features/dialogue/testing/dialogue-screen-test-helpers';

const UNANSWERED = testSessionDetails({
  utterances: [FIRST_QUESTION, PENDING_ANSWER],
});

describe('DialogueScreen with an answer that has no reply', () => {
  it('[TC-04-08] hides the form and the current-question label while the analysis failed', async () => {
    mockDialogueApi({
      analyze: () => errorResponse(503, ERROR_CODES.LANGUAGE_MODEL_UNAVAILABLE),
    });
    renderScreen(UNANSWERED);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.dialogue.errors.modelUnavailable,
    );
    expect(
      screen.getByRole('button', { name: uk.common.actions.retry }),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(uk.dialogue.form.label),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: uk.dialogue.form.submit }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(uk.dialogue.turns.currentQuestion),
    ).not.toBeInTheDocument();
    expect(screen.getByText(FIRST_QUESTION.text)).toBeInTheDocument();
  });

  it('[TC-04-08] brings the form back and focuses the new question after a successful retry', async () => {
    const user = userEvent.setup();
    let failing = true;
    mockDialogueApi({
      analyze: () =>
        failing
          ? errorResponse(503, ERROR_CODES.LANGUAGE_MODEL_UNAVAILABLE)
          : analysisOk(),
    });
    renderScreen(UNANSWERED);
    await screen.findByRole('alert');

    failing = false;
    await user.click(
      screen.getByRole('button', { name: uk.common.actions.retry }),
    );

    expect(
      await screen.findByLabelText(uk.dialogue.form.label),
    ).toBeInTheDocument();
    expect(currentCard().getByText(REPLY.text)).toBeInTheDocument();
    await waitFor(() => expect(currentCardElement()).toHaveFocus());
    expect(screen.getAllByText(uk.dialogue.turns.currentQuestion)).toHaveLength(
      1,
    );
  });
});
