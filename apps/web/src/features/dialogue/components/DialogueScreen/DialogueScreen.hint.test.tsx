import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFakeMedia } from '@/features/dialogue/testing/fake-media';
import uk from '@/shared/i18n/uk.json';
import { deferred } from '@/shared/testing/deferred';
import {
  HINT_PHRASE,
  HINT_TRANSLATION,
  mockDialogueApi,
} from '@/features/dialogue/testing/dialogue-mocks';
import { testSessionDetails } from '@/shared/testing/fixtures/session';
import {
  FIRST_QUESTION,
  REPLY,
  TURN,
  renderScreen,
  sendAnswer,
} from '@/features/dialogue/testing/dialogue-screen-test-helpers';

beforeEach(() => {
  installFakeMedia();
});

afterEach(() => {
  Reflect.deleteProperty(navigator, 'mediaDevices');
});

const hint = uk.dialogue.hint;
const hintButton = () => screen.getByRole('button', { name: hint.open });

describe('DialogueScreen hints', () => {
  it('[TC-04-05] offers a collapsed hint button next to the answer area', () => {
    renderScreen();

    expect(hintButton()).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.getByRole('button', { name: uk.dialogue.voice.record }),
    ).toBeInTheDocument();
  });

  it('[TC-04-05] shows a phrase start while the text form is open and keeps the typed text', async () => {
    const user = userEvent.setup();
    mockDialogueApi();
    renderScreen();

    await user.click(
      screen.getByRole('button', { name: uk.dialogue.voice.writeInstead }),
    );
    await user.type(screen.getByLabelText(uk.dialogue.form.label), 'I think');
    await user.click(hintButton());
    await user.click(screen.getByRole('button', { name: hint.phraseStart }));

    expect(await screen.findByText(HINT_PHRASE)).toBeInTheDocument();
    expect(screen.getByLabelText(uk.dialogue.form.label)).toHaveValue(
      'I think',
    );
  });

  it('[TC-04-10] translates a word before answering', async () => {
    const user = userEvent.setup();
    const api = mockDialogueApi();
    renderScreen();

    await user.click(hintButton());
    await user.click(screen.getByRole('button', { name: hint.translateWord }));
    await user.type(screen.getByLabelText(hint.word.label), 'зустріч');
    await user.click(screen.getByRole('button', { name: hint.word.submit }));

    expect(
      await screen.findByText(`зустріч = ${HINT_TRANSLATION}`),
    ).toBeInTheDocument();
    expect(api.hintRequests()).toEqual([
      { kind: 'translation', word: 'зустріч' },
    ]);
  });

  it('[TC-04-05] hides the hint button while an answer is being processed and brings it back for the next question', async () => {
    const user = userEvent.setup();
    const answer = deferred();
    mockDialogueApi({ answer: () => answer.promise });
    renderScreen();

    await user.click(
      screen.getByRole('button', { name: uk.dialogue.voice.writeInstead }),
    );
    await sendAnswer(user);

    expect(
      screen.queryByRole('button', { name: hint.open }),
    ).not.toBeInTheDocument();

    answer.resolve(
      new Response(JSON.stringify(TURN.utterance), { status: 201 }),
    );

    expect(
      await screen.findByRole('button', { name: hint.open }),
    ).toBeEnabled();
  });

  it('[TC-04-05] has no hint button for a finished session', () => {
    renderScreen(
      testSessionDetails({
        status: 'finished',
        endedAt: '2026-11-13T10:20:00.000Z',
        planRemaining: 0,
        utterances: [FIRST_QUESTION, TURN.utterance, REPLY],
      }),
    );

    expect(
      screen.queryByRole('button', { name: hint.open }),
    ).not.toBeInTheDocument();
  });
});
