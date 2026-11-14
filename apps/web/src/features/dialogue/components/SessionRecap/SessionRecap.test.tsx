import type { SessionDetails } from '@gototalk/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import uk from '@/shared/i18n/uk.json';
import {
  testSessionDetails,
  testTurnResult,
  testUtterance,
} from '@/shared/testing/test-fixtures';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { SessionRecap } from './SessionRecap';

const TURN = testTurnResult();
const FIRST_QUESTION = testUtterance();
const SECOND_QUESTION = TURN.reply ?? testUtterance();
const FAILED_ANSWER = testUtterance({
  id: 'answer-2',
  seq: 4,
  role: 'user',
  text: 'Because it is fun',
  analysisStatus: 'failed',
});

function finished(overrides: Partial<SessionDetails> = {}): SessionDetails {
  return testSessionDetails({
    status: 'finished',
    endedAt: '2026-11-13T10:21:00.000Z',
    utterances: [
      FIRST_QUESTION,
      TURN.utterance,
      SECOND_QUESTION,
      FAILED_ANSWER,
    ],
    ...overrides,
  });
}

function renderRecap(details: SessionDetails = finished()) {
  return renderWithProviders(<SessionRecap details={details} />);
}

describe('SessionRecap', () => {
  it('[TC-04-04] shows the recap heading and the stats', () => {
    renderRecap();

    expect(
      screen.getByRole('heading', { level: 2, name: uk.dialogue.recap.title }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(uk.dialogue.recap.answersLabel),
    ).toBeInTheDocument();
    expect(screen.getByText('2 відповіді')).toBeInTheDocument();
    expect(
      screen.getByText(uk.dialogue.recap.durationLabel),
    ).toBeInTheDocument();
    expect(screen.getByText('21 хвилина')).toBeInTheDocument();
  });

  it.each([
    ['2026-11-13T10:00:30.000Z', uk.dialogue.recap.underMinute],
    ['2026-11-13T10:01:00.000Z', '1 хвилина'],
    ['2026-11-13T10:02:00.000Z', '2 хвилини'],
    ['2026-11-13T10:05:00.000Z', '5 хвилин'],
    ['2026-11-13T10:11:00.000Z', '11 хвилин'],
    ['2026-11-13T10:12:00.000Z', '12 хвилин'],
    ['2026-11-13T10:14:00.000Z', '14 хвилин'],
    ['2026-11-13T10:21:00.000Z', '21 хвилина'],
  ])('[TC-04-04] writes the duration until %s as "%s"', (endedAt, text) => {
    renderRecap(finished({ endedAt }));

    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it.each([
    [1, '1 відповідь'],
    [2, '2 відповіді'],
    [5, '5 відповідей'],
    [11, '11 відповідей'],
    [12, '12 відповідей'],
    [14, '14 відповідей'],
    [21, '21 відповідь'],
  ])('[TC-04-04] writes %i answers as "%s"', (count, text) => {
    const answers = Array.from({ length: count }, (_value, index) =>
      testUtterance({
        id: `answer-${index}`,
        seq: index + 2,
        role: 'user',
        text: `Answer ${index}`,
        analysisStatus: 'done',
      }),
    );
    renderRecap(finished({ utterances: [FIRST_QUESTION, ...answers] }));

    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('[TC-04-04] omits the duration when the session has no end time', () => {
    renderRecap(finished({ endedAt: null }));

    expect(
      screen.queryByText(uk.dialogue.recap.durationLabel),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(uk.dialogue.recap.answersLabel),
    ).toBeInTheDocument();
  });

  it('[TC-04-04] lists every answer after the question it answers', () => {
    renderRecap();

    const items = within(
      screen.getByRole('list', { name: uk.dialogue.recap.listLabel }),
    ).getAllByRole('listitem');

    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent(FIRST_QUESTION.text);
    expect(items[0]).toHaveTextContent(TURN.utterance.text);
    expect(items[1]).toHaveTextContent(SECOND_QUESTION.text);
    expect(items[1]).toHaveTextContent(FAILED_ANSWER.text);
  });

  it('[TC-04-11] highlights the mistakes and shows details even in the deferred mode', async () => {
    const user = userEvent.setup();
    renderRecap(
      finished({
        feedbackMode: 'deferred',
        utterances: [
          FIRST_QUESTION,
          {
            ...TURN.utterance,
            better: [{ original: 'I go', better: 'I went' }],
          },
        ],
      }),
    );

    await user.click(screen.getByRole('button', { name: 'go' }));

    expect(
      screen.getByText(TURN.utterance.mistakes[0]?.explanationEn ?? ''),
    ).toBeInTheDocument();
    expect(screen.getByText(uk.transcript.better.title)).toBeInTheDocument();
  });

  it('[TC-04-04] shows an answer without a finished analysis as plain text', () => {
    renderRecap();

    expect(screen.getByText(FAILED_ANSWER.text)).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('[TC-04-04] shows zero answers and no list for a session without answers', () => {
    renderRecap(finished({ utterances: [FIRST_QUESTION] }));

    expect(screen.getByText('0 відповідей')).toBeInTheDocument();
    expect(
      screen.queryByRole('list', { name: uk.dialogue.recap.listLabel }),
    ).not.toBeInTheDocument();
  });
});
