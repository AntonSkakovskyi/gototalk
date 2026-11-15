import { ERROR_CODES } from '@gototalk/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { uk } from '@/shared/i18n/resources';
import {
  analysisOk,
  mockDialogueApi,
} from '@/features/dialogue/testing/dialogue-mocks';
import { errorResponse, jsonResponse } from '@/shared/testing/http-responses';
import {
  testSessionDetails,
  testUtterance,
} from '@/shared/testing/fixtures/session';
import {
  FIRST_QUESTION,
  PENDING_ANSWER,
  REPLY,
  TURN,
  currentCard,
  currentCardElement,
  renderScreen,
  sendAnswer,
} from '@/features/dialogue/testing/dialogue-screen-test-helpers';

describe('DialogueScreen states', () => {
  it('[TC-04-08] keeps the typed text and shows the mapped error when sending fails', async () => {
    const user = userEvent.setup();
    mockDialogueApi({ answer: () => errorResponse(500, 'INTERNAL_ERROR') });
    renderScreen();

    await sendAnswer(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.errors.generic,
    );
    expect(screen.getByLabelText(uk.dialogue.form.label)).toHaveValue(
      'I very like',
    );
    expect(
      screen.queryByRole('button', { name: uk.common.actions.retry }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: uk.dialogue.form.submit }),
    ).toBeEnabled();
  });

  it('[TC-04-08] offers a retry after an unavailable analysis and completes the turn', async () => {
    const user = userEvent.setup();
    let failing = true;
    mockDialogueApi({
      answer: () => jsonResponse(PENDING_ANSWER, 201),
      analyze: () =>
        failing
          ? errorResponse(503, ERROR_CODES.LANGUAGE_MODEL_UNAVAILABLE)
          : analysisOk(),
    });
    renderScreen();

    await sendAnswer(user);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.dialogue.errors.modelUnavailable,
    );
    expect(screen.getByText(TURN.utterance.text)).toBeInTheDocument();

    failing = false;
    await user.click(
      screen.getByRole('button', { name: uk.common.actions.retry }),
    );

    expect(
      await screen.findByRole('button', { name: 'go' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(currentCard().getByText(REPLY.text)).toBeInTheDocument();
  });

  it('[TC-04-08] shows no retry for an analysis that cannot be retried', async () => {
    const user = userEvent.setup();
    mockDialogueApi({
      answer: () => jsonResponse(PENDING_ANSWER, 201),
      analyze: () => errorResponse(404, ERROR_CODES.UTTERANCE_NOT_FOUND),
    });
    renderScreen();

    await sendAnswer(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.dialogue.errors.utteranceNotFound,
    );
    expect(
      screen.queryByRole('button', { name: uk.common.actions.retry }),
    ).not.toBeInTheDocument();
  });

  it('[TC-04-08] analyses an unanswered last utterance once on mount', async () => {
    const api = mockDialogueApi();
    renderScreen(
      testSessionDetails({ utterances: [FIRST_QUESTION, PENDING_ANSWER] }),
    );

    expect(await screen.findByText(REPLY.text)).toBeInTheDocument();

    expect(
      api.requests.filter((request) => request.path.endsWith('/analysis')),
    ).toHaveLength(1);
    expect(api.answerRequests()).toHaveLength(0);
  });

  it('[TC-04-04] lists the turns by seq and marks only the last question as current', () => {
    renderScreen(
      testSessionDetails({
        utterances: [
          testUtterance({ id: 'c', seq: 3, text: 'Second?' }),
          testUtterance({ id: 'a', seq: 1, text: 'First?' }),
          testUtterance({
            id: 'b',
            seq: 2,
            role: 'user',
            text: 'My answer',
            analysisStatus: 'failed',
          }),
        ],
      }),
    );

    const items = within(
      screen.getByRole('list', { name: uk.dialogue.turns.label }),
    ).getAllByRole('listitem');

    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('First?'),
      expect.stringContaining('My answer'),
      expect.stringContaining('Second?'),
    ]);
    expect(screen.getAllByText(uk.dialogue.turns.currentQuestion)).toHaveLength(
      1,
    );
    expect(currentCard().getByText('Second?')).toHaveAttribute('lang', 'en');
    expect(screen.getByText('First?')).toHaveAttribute('lang', 'en');
  });

  it('[TC-04-04] moves focus to the next question after the reply arrives, not on mount', async () => {
    const user = userEvent.setup();
    mockDialogueApi({ answer: () => jsonResponse(PENDING_ANSWER, 201) });
    renderScreen();

    expect(currentCardElement()).not.toHaveFocus();

    await sendAnswer(user);

    await waitFor(() => expect(currentCardElement()).toHaveFocus());
    expect(currentCard().getByText(REPLY.text)).toBeInTheDocument();
  });

  it('[TC-04-04] shows a finished session read-only', () => {
    const { container } = renderScreen(
      testSessionDetails({
        status: 'finished',
        endedAt: '2026-11-13T10:20:00.000Z',
        planRemaining: 0,
        utterances: [FIRST_QUESTION, TURN.utterance, REPLY],
      }),
    );

    expect(screen.getByRole('button', { name: 'go' })).toBeInTheDocument();
    expect(
      screen.queryByLabelText(uk.dialogue.form.label),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: uk.dialogue.form.submit }),
    ).not.toBeInTheDocument();
    expect(container.querySelector('[aria-live]')).not.toBeInTheDocument();
    expect(
      screen.queryByText(uk.dialogue.planExhausted),
    ).not.toBeInTheDocument();
  });

  it.each([
    [0, true],
    [2, false],
  ])(
    '[TC-04-04] with %i plan questions left the exhausted note shown is %s',
    (left, shown) => {
      renderScreen(testSessionDetails({ planRemaining: left }));

      expect(screen.queryByText(uk.dialogue.planExhausted) !== null).toBe(
        shown,
      );
      expect(screen.getByLabelText(uk.dialogue.form.label)).toBeEnabled();
    },
  );
});
