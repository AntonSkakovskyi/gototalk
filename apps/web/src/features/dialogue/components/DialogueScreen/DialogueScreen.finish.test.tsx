import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import uk from '@/shared/i18n/uk.json';
import { deferred } from '@/shared/testing/deferred';
import { mockDialogueApi } from '@/features/dialogue/testing/dialogue-mocks';
import { DIALOGUE_SESSION_ID } from '@/entities/session/testing/session-entity-mocks';
import { jsonResponse } from '@/shared/testing/http-responses';
import { testSessionDetails } from '@/shared/testing/fixtures/session';
import {
  FIRST_QUESTION,
  PENDING_ANSWER,
  REPLY,
  TURN,
  renderScreen,
  sendAnswer,
} from '@/features/dialogue/testing/dialogue-screen-test-helpers';

const FINISHED = testSessionDetails({
  status: 'finished',
  endedAt: '2026-11-13T10:20:00.000Z',
  planRemaining: 0,
  utterances: [FIRST_QUESTION, TURN.utterance, REPLY],
});

describe('DialogueScreen finishing', () => {
  it('[TC-04-04] offers the report link instead of the composer for a finished session', () => {
    renderScreen(FINISHED);

    expect(
      screen.getByRole('link', { name: uk.dialogue.finish.toReport }),
    ).toHaveAttribute('href', `/sessions/${DIALOGUE_SESSION_ID}/report`);
    expect(
      screen.queryByLabelText(uk.dialogue.form.label),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: uk.dialogue.finish.open }),
    ).not.toBeInTheDocument();
  });

  it('[TC-04-04] shows the finish button and no report link for an active session', () => {
    renderScreen();

    expect(
      screen.getByRole('button', { name: uk.dialogue.finish.open }),
    ).toBeEnabled();
    expect(
      screen.queryByRole('link', { name: uk.dialogue.finish.toReport }),
    ).not.toBeInTheDocument();
  });

  it('[TC-04-04] disables the finish button while an answer is being processed', async () => {
    const user = userEvent.setup();
    const answer = deferred();
    mockDialogueApi({ answer: () => answer.promise });
    renderScreen();

    await sendAnswer(user);

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: uk.dialogue.finish.open }),
      ).toBeDisabled(),
    );
    answer.resolve(jsonResponse(PENDING_ANSWER, 201));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: uk.dialogue.finish.open }),
      ).toBeEnabled(),
    );
  });

  it('[TC-04-04] goes to the report after confirming, once the cache holds the finished session', async () => {
    const user = userEvent.setup();
    const api = mockDialogueApi();
    renderScreen();

    await user.click(
      screen.getByRole('button', { name: uk.dialogue.finish.open }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: uk.dialogue.finish.title,
    });
    await user.click(
      within(dialog).getByRole('button', { name: uk.common.actions.finish }),
    );

    await waitFor(() =>
      expect(screen.getByTestId('location-path')).toHaveTextContent(
        `/sessions/${DIALOGUE_SESSION_ID}/report`,
      ),
    );
    expect(api.finishRequests()).toHaveLength(1);
    expect(
      await screen.findByRole('link', { name: uk.dialogue.finish.toReport }),
    ).toBeInTheDocument();
  });
});
