import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import uk from '@/shared/i18n/uk.json';
import { deferred } from '@/shared/testing/deferred';
import {
  analysisOk,
  mockDialogueApi,
} from '@/features/dialogue/testing/dialogue-mocks';
import { jsonResponse } from '@/shared/testing/http-responses';
import { testSessionDetails } from '@/shared/testing/fixtures/session';
import {
  PENDING_ANSWER,
  REPLY,
  TURN,
  analysisWithBetter,
  currentCard,
  renderScreen,
  sendAnswer,
} from './dialogue-screen-test-helpers';

describe('DialogueScreen answer flow', () => {
  it('[TC-04-04] takes a text answer through analysis, the mistake details and the next question', async () => {
    const user = userEvent.setup();
    const analysis = deferred();
    const api = mockDialogueApi({
      answer: () => jsonResponse(PENDING_ANSWER, 201),
      analyze: () => analysis.promise,
    });
    renderScreen();

    await sendAnswer(user);

    expect(await screen.findByText(uk.dialogue.status.analyzing)).toBeVisible();
    expect(api.answerRequests()).toEqual([{ text: 'I very like' }]);
    expect(
      screen.queryByLabelText(uk.dialogue.form.label),
    ).not.toBeInTheDocument();

    analysis.resolve(analysisWithBetter());
    const fragment = await screen.findByRole('button', { name: 'go' });
    expect(screen.getByText(uk.transcript.better.title)).toBeInTheDocument();

    await user.click(fragment);
    expect(
      screen.getByText(TURN.utterance.mistakes[0]?.explanationEn ?? ''),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: uk.transcript.mistake.notMistake }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'go' }),
      ).not.toBeInTheDocument(),
    );
    expect(currentCard().getByText(REPLY.text)).toBeInTheDocument();
    expect(screen.getAllByText(uk.dialogue.turns.currentQuestion)).toHaveLength(
      1,
    );
    expect(screen.getByLabelText(uk.dialogue.form.label)).toHaveValue('');
  });

  it('[TC-04-11] shows no highlights and no better phrasings in the deferred mode', async () => {
    const user = userEvent.setup();
    mockDialogueApi({
      answer: () => jsonResponse(PENDING_ANSWER, 201),
      analyze: analysisWithBetter,
    });
    renderScreen(testSessionDetails({ feedbackMode: 'deferred' }));

    await sendAnswer(user);

    expect(await screen.findByText(REPLY.text)).toBeInTheDocument();
    expect(screen.getByText(TURN.utterance.text)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'go' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(uk.transcript.better.title),
    ).not.toBeInTheDocument();
  });

  it('[TC-04-12] announces sending, then analyzing, then nothing', async () => {
    const user = userEvent.setup();
    const answer = deferred();
    const analysis = deferred();
    mockDialogueApi({
      answer: () => answer.promise,
      analyze: () => analysis.promise,
    });
    renderScreen();

    await sendAnswer(user);
    expect(await screen.findByText(uk.dialogue.status.sending)).toBeVisible();
    expect(
      screen.queryByText(uk.dialogue.status.analyzing),
    ).not.toBeInTheDocument();

    answer.resolve(jsonResponse(PENDING_ANSWER, 201));
    expect(await screen.findByText(uk.dialogue.status.analyzing)).toBeVisible();
    expect(
      screen.queryByText(uk.dialogue.status.sending),
    ).not.toBeInTheDocument();
    expect(screen.getByText(TURN.utterance.text)).toBeInTheDocument();

    analysis.resolve(analysisOk());
    await waitFor(() =>
      expect(
        screen.queryByText(uk.dialogue.status.analyzing),
      ).not.toBeInTheDocument(),
    );
  });
});
