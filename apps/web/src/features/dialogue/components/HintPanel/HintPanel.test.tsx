import { ERROR_CODES, HINT_WORD_MAX } from '@gototalk/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import uk from '@/shared/i18n/uk.json';
import {
  DIALOGUE_SESSION_ID,
  HINT_PHRASE,
  HINT_TRANSLATION,
  mockDialogueApi,
} from '@/shared/testing/dialogue-mocks';
import { errorResponse, jsonResponse } from '@/shared/testing/test-fixtures';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { HintPanel } from './HintPanel';

const hint = uk.dialogue.hint;

function renderPanel() {
  return renderWithProviders(<HintPanel sessionId={DIALOGUE_SESSION_ID} />);
}

const openButton = () => screen.getByRole('button', { name: hint.open });
const phraseButton = () =>
  screen.getByRole('button', { name: hint.phraseStart });
const wordButton = () =>
  screen.getByRole('button', { name: hint.translateWord });
const wordField = () => screen.getByLabelText(hint.word.label);

async function openTranslateForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(openButton());
  await user.click(wordButton());
}

describe('HintPanel', () => {
  it('[TC-04-05] is collapsed by default behind a hint button', () => {
    renderPanel();

    expect(openButton()).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByRole('button', { name: hint.phraseStart }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: hint.translateWord }),
    ).not.toBeInTheDocument();
  });

  it('[TC-04-05] opens and closes with the hint button', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(openButton());

    expect(openButton()).toHaveAttribute('aria-expanded', 'true');
    expect(phraseButton()).toBeEnabled();
    expect(wordButton()).toBeEnabled();

    await user.click(openButton());

    expect(
      screen.queryByRole('button', { name: hint.phraseStart }),
    ).not.toBeInTheDocument();
  });

  it('[TC-04-05] shows the phrase start as readable text', async () => {
    const user = userEvent.setup();
    const api = mockDialogueApi();
    renderPanel();

    await user.click(openButton());
    await user.click(phraseButton());

    expect(await screen.findByText(HINT_PHRASE)).toHaveAttribute('lang', 'en');
    expect(screen.getByText(hint.result.phraseStart)).toBeInTheDocument();
    expect(api.hintRequests()).toEqual([{ kind: 'phrase_start' }]);
  });

  it('[TC-04-10] translates a known word and shows word = translation', async () => {
    const user = userEvent.setup();
    const api = mockDialogueApi();
    renderPanel();

    await openTranslateForm(user);
    expect(wordField()).toHaveFocus();
    expect(wordField()).toHaveAttribute('lang', 'uk');
    await user.type(wordField(), '  зустріч ');
    await user.click(screen.getByRole('button', { name: hint.word.submit }));

    expect(
      await screen.findByText(`зустріч = ${HINT_TRANSLATION}`),
    ).toBeInTheDocument();
    expect(api.hintRequests()).toEqual([
      { kind: 'translation', word: 'зустріч' },
    ]);
  });

  it('[TC-04-10] submits the word with Enter', async () => {
    const user = userEvent.setup();
    const api = mockDialogueApi();
    renderPanel();

    await openTranslateForm(user);
    await user.type(wordField(), 'зустріч{Enter}');

    expect(
      await screen.findByText(`зустріч = ${HINT_TRANSLATION}`),
    ).toBeInTheDocument();
    expect(api.hintRequests()).toHaveLength(1);
  });

  it('[TC-04-10] shows the vocabulary text, not a model message, for an unknown word', async () => {
    const user = userEvent.setup();
    mockDialogueApi({
      hint: () =>
        jsonResponse({ kind: 'translation', word: null, message: 'nope' }),
    });
    renderPanel();

    await openTranslateForm(user);
    await user.type(wordField(), 'щось');
    await user.click(screen.getByRole('button', { name: hint.word.submit }));

    expect(await screen.findByText(hint.result.unknown)).toBeInTheDocument();
    expect(screen.queryByText('nope')).not.toBeInTheDocument();
  });

  it('[TC-04-10] asks for a word instead of sending an empty or blank one', async () => {
    const user = userEvent.setup();
    const api = mockDialogueApi();
    renderPanel();

    await openTranslateForm(user);
    await user.click(screen.getByRole('button', { name: hint.word.submit }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      hint.word.errors.required,
    );
    await user.type(wordField(), '   ');
    await user.click(screen.getByRole('button', { name: hint.word.submit }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        hint.word.errors.required,
      ),
    );
    expect(api.hintRequests()).toEqual([]);
  });

  it('[TC-04-10] rejects a word longer than the limit', async () => {
    const user = userEvent.setup();
    const api = mockDialogueApi();
    renderPanel();

    await openTranslateForm(user);
    await user.type(wordField(), 'я'.repeat(HINT_WORD_MAX + 1));
    await user.click(screen.getByRole('button', { name: hint.word.submit }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      hint.word.errors.tooLong.replace('{{max}}', String(HINT_WORD_MAX)),
    );
    expect(api.hintRequests()).toEqual([]);
  });

  it('[TC-04-10] shows a loading state and locks the actions while the hint is requested', async () => {
    const user = userEvent.setup();
    let release: (response: Response) => void = () => undefined;
    mockDialogueApi({
      hint: () =>
        new Promise<Response>((done) => {
          release = done;
        }),
    });
    renderPanel();

    await user.click(openButton());
    await user.click(phraseButton());

    expect(await screen.findByText(hint.loading)).toBeInTheDocument();
    expect(phraseButton()).toBeDisabled();
    expect(wordButton()).toBeDisabled();

    release(jsonResponse({ kind: 'phrase_start', text: HINT_PHRASE }));

    expect(await screen.findByText(HINT_PHRASE)).toBeInTheDocument();
    expect(screen.queryByText(hint.loading)).not.toBeInTheDocument();
    expect(phraseButton()).toBeEnabled();
  });

  it('[TC-04-10] shows the unavailable error and retries the same request', async () => {
    const user = userEvent.setup();
    let calls = 0;
    const api = mockDialogueApi({
      hint: () => {
        calls += 1;
        return calls === 1
          ? errorResponse(503, ERROR_CODES.LANGUAGE_MODEL_UNAVAILABLE)
          : jsonResponse({ kind: 'translation', word: HINT_TRANSLATION });
      },
    });
    renderPanel();

    await openTranslateForm(user);
    await user.type(wordField(), 'зустріч');
    await user.click(screen.getByRole('button', { name: hint.word.submit }));

    expect(
      await screen.findByText(hint.errors.modelUnavailable),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: uk.common.actions.retry }),
    );

    expect(
      await screen.findByText(`зустріч = ${HINT_TRANSLATION}`),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(hint.errors.modelUnavailable),
    ).not.toBeInTheDocument();
    expect(api.hintRequests()).toEqual([
      { kind: 'translation', word: 'зустріч' },
      { kind: 'translation', word: 'зустріч' },
    ]);
  });

  it('[TC-04-10] shows the invalid-response error with a retry', async () => {
    const user = userEvent.setup();
    mockDialogueApi({
      hint: () =>
        errorResponse(502, ERROR_CODES.LANGUAGE_MODEL_INVALID_RESPONSE),
    });
    renderPanel();

    await user.click(openButton());
    await user.click(phraseButton());

    expect(
      await screen.findByText(hint.errors.modelInvalidResponse),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: uk.common.actions.retry }),
    ).toBeEnabled();
  });

  it('[TC-04-10] shows the finished-session error without a retry', async () => {
    const user = userEvent.setup();
    mockDialogueApi({
      hint: () => errorResponse(409, ERROR_CODES.SESSION_FINISHED),
    });
    renderPanel();

    await user.click(openButton());
    await user.click(phraseButton());

    expect(
      await screen.findByText(uk.dialogue.errors.sessionFinished),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: uk.common.actions.retry }),
    ).not.toBeInTheDocument();
  });

  it('[TC-04-10] shows the generic error after a network failure', async () => {
    const user = userEvent.setup();
    mockDialogueApi({
      hint: () => Promise.reject(new TypeError('Failed to fetch')),
    });
    renderPanel();

    await user.click(openButton());
    await user.click(phraseButton());

    expect(await screen.findByText(uk.errors.generic)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: uk.common.actions.retry }),
    ).toBeEnabled();
  });

  it('[TC-04-05] announces results and errors in a polite live region', async () => {
    const user = userEvent.setup();
    mockDialogueApi();
    renderPanel();

    await user.click(openButton());
    await user.click(phraseButton());

    const phrase = await screen.findByText(HINT_PHRASE);
    expect(phrase.closest('[aria-live]')).toHaveAttribute(
      'aria-live',
      'polite',
    );
  });

  it('[TC-04-05] hides the previous result when switching to the word form', async () => {
    const user = userEvent.setup();
    mockDialogueApi();
    renderPanel();

    await user.click(openButton());
    await user.click(phraseButton());
    await screen.findByText(HINT_PHRASE);
    await user.click(wordButton());

    expect(screen.queryByText(HINT_PHRASE)).not.toBeInTheDocument();
    expect(wordField()).toBeInTheDocument();

    await user.click(phraseButton());

    expect(await screen.findByText(HINT_PHRASE)).toBeInTheDocument();
    expect(screen.queryByLabelText(hint.word.label)).not.toBeInTheDocument();
  });

  it('[TC-04-05] works from the keyboard', async () => {
    const user = userEvent.setup();
    mockDialogueApi();
    renderPanel();

    await user.tab();
    expect(openButton()).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.tab();
    expect(phraseButton()).toHaveFocus();
    await user.keyboard(' ');

    expect(await screen.findByText(HINT_PHRASE)).toBeInTheDocument();
  });
});
