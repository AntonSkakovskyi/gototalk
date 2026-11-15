import { ERROR_CODES, type SessionDetails } from '@gototalk/shared';
import { useQuery } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  sessionDetailsQueryOptions,
  sessionKeys,
} from '@/shared/api/session-details';
import uk from '@/shared/i18n/uk.json';
import {
  DIALOGUE_SESSION_ID,
  mockDialogueApi,
} from '@/shared/testing/dialogue-mocks';
import { createTestQueryClient } from '@/shared/testing/query-wrapper';
import { errorResponse } from '@/shared/testing/http-responses';
import {
  testSessionDetails,
  testTurnResult,
} from '@/shared/testing/fixtures/session';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { AnswerTranscript } from './AnswerTranscript';

const ANSWER = testTurnResult().utterance;
const DETAILS = testSessionDetails({ utterances: [ANSWER] });
const MARK_LABEL = uk.transcript.mistake.notMistake;

function CachedTranscript() {
  const { data } = useQuery(sessionDetailsQueryOptions(DIALOGUE_SESSION_ID));
  const utterance = data?.utterances.find((item) => item.id === ANSWER.id);
  return utterance ? (
    <AnswerTranscript
      sessionId={DIALOGUE_SESSION_ID}
      utterance={utterance}
      showFeedback
    />
  ) : null;
}

async function setup(markMistake?: () => Response | Promise<Response>) {
  const api = mockDialogueApi(markMistake ? { markMistake } : {});
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(sessionKeys.details(DIALOGUE_SESSION_ID), DETAILS);
  renderWithProviders(<CachedTranscript />, { queryClient });
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'go' }));
  return { api, queryClient, user };
}

const markButton = () => screen.getByRole('button', { name: MARK_LABEL });

describe('AnswerTranscript marking a mistake as not a mistake', () => {
  it('[TC-04-04] sends the PATCH, drops the highlight and closes the explanation', async () => {
    const { api, queryClient, user } = await setup();

    await user.click(markButton());

    await waitFor(() =>
      expect(screen.queryByRole('region')).not.toBeInTheDocument(),
    );
    expect(api.markMistakeRequests()).toEqual([{ isFalse: true }]);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText(ANSWER.text)).toBeInTheDocument();
    expect(
      queryClient.getQueryData<SessionDetails>(
        sessionKeys.details(DIALOGUE_SESSION_ID),
      )?.utterances[0]?.mistakes[0]?.isFalse,
    ).toBe(true);
  });

  it('[TC-04-04] moves focus to the answer text after the fragment disappears', async () => {
    const { user } = await setup();

    await user.click(markButton());

    await waitFor(() => expect(screen.getByText(ANSWER.text)).toHaveFocus());
    expect(screen.getByText(ANSWER.text)).toHaveAttribute('tabindex', '-1');
  });

  it('[TC-04-04] announces the result in a polite live region', async () => {
    const { user } = await setup();

    await user.click(markButton());

    const message = await screen.findByText(
      uk.transcript.mistake.markedAsNotMistake,
    );
    expect(message.closest('[aria-live]')).toHaveAttribute(
      'aria-live',
      'polite',
    );
  });

  it('[TC-04-04] does not announce anything before a mistake is marked', async () => {
    await setup();

    expect(
      screen.queryByText(uk.transcript.mistake.markedAsNotMistake),
    ).not.toBeInTheDocument();
  });

  it('[TC-04-04] disables the button while the request is pending', async () => {
    const { api, user } = await setup(
      () => new Promise<Response>(() => undefined),
    );

    await user.click(markButton());

    expect(markButton()).toBeDisabled();
    expect(api.markMistakeRequests()).toHaveLength(1);
    expect(screen.getByRole('region')).toBeInTheDocument();
  });

  it('[TC-04-04] shows the mapped error in a polite live region and keeps the explanation open', async () => {
    const { user } = await setup(() =>
      errorResponse(404, ERROR_CODES.MISTAKE_NOT_FOUND),
    );

    await user.click(markButton());

    const message = await screen.findByText(
      uk.transcript.errors.mistakeNotFound,
    );
    expect(message.closest('[aria-live]')).toHaveAttribute(
      'aria-live',
      'polite',
    );
    expect(screen.getByRole('region')).toBeInTheDocument();
    expect(markButton()).toBeEnabled();
    expect(screen.getByRole('button', { name: 'go' })).toBeInTheDocument();
  });
});
