import type { Utterance } from '@gototalk/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import uk from '@/shared/i18n/uk.json';
import { DIALOGUE_SESSION_ID } from '@/shared/testing/dialogue-mocks';
import { testMistake, testTurnResult } from '@/shared/testing/test-fixtures';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { AnswerTranscript } from './AnswerTranscript';

const ANSWER = testTurnResult().utterance;
const BETTER = [{ original: 'I go', better: 'I went' }];
const SECOND = testMistake({
  id: '3f6b2d18-9c4e-4a7b-b2d0-5e8a1c7f0002',
  start: 20,
  end: 29,
  original: 'yesterday',
  suggestion: 'the day before',
  category: 'word_choice',
  explanationEn: 'Prefer a more natural phrase.',
});

function renderTranscript(utterance: Utterance = ANSWER, showFeedback = true) {
  return renderWithProviders(
    <AnswerTranscript
      sessionId={DIALOGUE_SESSION_ID}
      utterance={utterance}
      showFeedback={showFeedback}
    />,
  );
}

function withMistakes(...mistakes: Utterance['mistakes']): Utterance {
  return { ...ANSWER, mistakes };
}

describe('AnswerTranscript', () => {
  it('[TC-04-04] renders one button per valid mistake and none for false or invalid ones', () => {
    renderTranscript(
      withMistakes(
        testMistake(),
        { ...SECOND, isFalse: true },
        testMistake({
          id: '3f6b2d18-9c4e-4a7b-b2d0-5e8a1c7f0003',
          start: 5,
          end: 9,
          original: 'wrong',
        }),
      ),
    );

    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'go' })).toBeInTheDocument();
  });

  it('[TC-04-04] describes every fragment with a hint without renaming it', () => {
    renderTranscript();

    const fragment = screen.getByRole('button', { name: 'go' });

    expect(fragment).toHaveAccessibleDescription(
      uk.dialogue.mistake.fragmentHint,
    );
  });

  it('[TC-04-04] renders no fragment hint for an answer without mistakes', () => {
    renderTranscript(withMistakes());

    expect(
      screen.queryByText(uk.dialogue.mistake.fragmentHint),
    ).not.toBeInTheDocument();
  });

  it('[TC-04-04] marks the answer text as English', () => {
    renderTranscript();

    expect(
      screen.getByRole('button', { name: 'go' }).closest('[lang]'),
    ).toHaveAttribute('lang', 'en');
  });

  it('[TC-04-04] opens the explanation for a clicked fragment and closes it on a second click', async () => {
    const user = userEvent.setup();
    renderTranscript();
    const fragment = screen.getByRole('button', { name: 'go' });

    expect(fragment).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region')).not.toBeInTheDocument();

    await user.click(fragment);
    const region = screen.getByRole('region', {
      name: uk.dialogue.mistake.regionLabel,
    });

    expect(fragment).toHaveAttribute('aria-expanded', 'true');
    expect(fragment).toHaveAttribute('aria-controls', region.id);
    expect(
      within(region).getByText(testMistake().explanationEn),
    ).toHaveAttribute('lang', 'en');
    expect(
      within(region).getByText(testMistake().translationUk),
    ).toBeInTheDocument();
    expect(
      within(region).getByText(uk.mistakeCategories.verb_tense),
    ).toBeInTheDocument();

    await user.click(fragment);

    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(fragment).toHaveAttribute('aria-expanded', 'false');
  });

  it('[TC-04-04] keeps one explanation open at a time', async () => {
    const user = userEvent.setup();
    renderTranscript(withMistakes(testMistake(), SECOND));

    await user.click(screen.getByRole('button', { name: 'go' }));
    await user.click(screen.getByRole('button', { name: 'yesterday' }));

    expect(screen.getAllByRole('region')).toHaveLength(1);
    expect(screen.getByText(SECOND.explanationEn)).toBeInTheDocument();
    expect(
      screen.queryByText(testMistake().explanationEn),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'go' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it.each([
    ['Enter', '{Enter}'],
    ['Space', ' '],
  ])(
    '[TC-04-14] opens the explanation from the keyboard with %s',
    async (_name, key) => {
      const user = userEvent.setup();
      renderTranscript();

      await user.tab();
      expect(screen.getByRole('button', { name: 'go' })).toHaveFocus();
      await user.keyboard(key);

      expect(screen.getByRole('region')).toBeInTheDocument();
    },
  );

  it('[TC-04-14] distinguishes fragments by underline and shows the correction with del and ins', async () => {
    const user = userEvent.setup();
    renderTranscript();
    const fragment = screen.getByRole('button', { name: 'go' });

    expect(fragment).toHaveClass('fragment');
    expect(fragment).toHaveAttribute('type', 'button');

    await user.click(fragment);
    const region = screen.getByRole('region');

    expect(region.querySelector('del')).toHaveTextContent('go');
    expect(region.querySelector('ins')).toHaveTextContent('went');
  });

  it('[TC-04-11] shows plain text without buttons, details or better phrasings in deferred mode', () => {
    renderTranscript({ ...ANSWER, better: BETTER }, false);

    expect(screen.getByText(ANSWER.text)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(
      screen.queryByText(uk.dialogue.better.title),
    ).not.toBeInTheDocument();
  });

  it.each(['pending', 'failed'] as const)(
    '[TC-04-04] shows plain text while the analysis is %s',
    (analysisStatus) => {
      renderTranscript({ ...ANSWER, analysisStatus });

      expect(screen.getByText(ANSWER.text)).toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    },
  );

  it('[TC-04-04] lists better phrasings under the transcript when feedback is shown', () => {
    renderTranscript({ ...ANSWER, better: BETTER });

    const list = screen.getByRole('list');

    expect(
      screen.getByRole('heading', {
        level: 3,
        name: uk.dialogue.better.title,
      }),
    ).toBeInTheDocument();
    expect(within(list).getByText('I go')).toHaveAttribute('lang', 'en');
    expect(within(list).getByText('I went')).toHaveAttribute('lang', 'en');
  });

  it('[TC-04-04] reads the arrows as a word and hides the symbol from assistive technology', async () => {
    const user = userEvent.setup();
    renderTranscript({ ...ANSWER, better: BETTER });
    const phrasing = within(screen.getByRole('list')).getByRole('listitem');

    expect(within(phrasing).getByText('→')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(
      within(phrasing).getByText(uk.dialogue.replacedBy),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'go' }));
    const region = screen.getByRole('region');

    expect(within(region).getByText('→')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(
      within(region).getByText(uk.dialogue.replacedBy),
    ).toBeInTheDocument();
  });

  it('[TC-04-04] omits the better phrasings block when there are none', () => {
    renderTranscript();

    expect(
      screen.queryByText(uk.dialogue.better.title),
    ).not.toBeInTheDocument();
  });
});
