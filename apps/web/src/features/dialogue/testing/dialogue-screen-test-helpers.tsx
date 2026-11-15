import type { SessionDetails } from '@gototalk/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useQuery } from '@tanstack/react-query';
import {
  sessionDetailsQueryOptions,
  sessionKeys,
} from '@/entities/session/api/session-details';
import { uk } from '@/shared/i18n/resources';
import { DIALOGUE_SESSION_ID } from '@/entities/session/testing/session-entity-mocks';
import { createTestQueryClient } from '@/shared/testing/query-wrapper';
import { jsonResponse } from '@/shared/testing/http-responses';
import {
  testSessionDetails,
  testTurnResult,
  testUtterance,
} from '@/shared/testing/fixtures/session';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { LocationProbe } from '@/shared/testing/LocationProbe';
import { DialogueScreen } from '@/features/dialogue/components/DialogueScreen/DialogueScreen';

export const TURN = testTurnResult();
export const REPLY = TURN.reply ?? testUtterance();
export const FIRST_QUESTION = testUtterance();
export const PENDING_ANSWER = {
  ...TURN.utterance,
  analysisStatus: 'pending' as const,
  mistakes: [],
};

function Harness() {
  const { data } = useQuery(sessionDetailsQueryOptions(DIALOGUE_SESSION_ID));
  return (
    <>
      {data ? <DialogueScreen details={data} /> : null}
      <LocationProbe />
    </>
  );
}

export function renderScreen(details: SessionDetails = testSessionDetails()) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(sessionKeys.details(DIALOGUE_SESSION_ID), details);
  return renderWithProviders(<Harness />, { queryClient });
}

export function analysisWithBetter() {
  return jsonResponse(
    {
      ...TURN,
      utterance: {
        ...TURN.utterance,
        better: [{ original: 'I go', better: 'I went' }],
      },
    },
    201,
  );
}

export async function sendAnswer(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(uk.dialogue.form.label), 'I very like');
  await user.click(
    screen.getByRole('button', { name: uk.dialogue.form.submit }),
  );
}

export function currentCardElement(): HTMLElement {
  const card = screen
    .getByText(uk.dialogue.turns.currentQuestion)
    .closest('section');
  if (card === null) {
    throw new Error('The current question card is missing');
  }
  return card;
}

export function currentCard() {
  return within(currentCardElement());
}
