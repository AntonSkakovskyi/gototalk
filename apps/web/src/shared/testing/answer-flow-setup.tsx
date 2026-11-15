import type { SessionDetails } from '@gototalk/shared';
import { renderHook } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { useAnswerFlow } from '@/features/dialogue/hooks/use-answer-flow';
import { sessionKeys } from '@/entities/session/api/session-details';
import { DIALOGUE_SESSION_ID } from './dialogue-mocks';
import { createQueryWrapper, createTestQueryClient } from './query-wrapper';
import {
  testSessionDetails,
  testTurnResult,
  testUtterance,
} from './fixtures/session';

export const TURN = testTurnResult();
export const ANSWER_TEXT = TURN.utterance.text;
export const PENDING = {
  ...TURN.utterance,
  analysisStatus: 'pending' as const,
  mistakes: [],
};

export function setup(details: SessionDetails = testSessionDetails()) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(sessionKeys.details(DIALOGUE_SESSION_ID), details);
  const QueryWrapper = createQueryWrapper(queryClient);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <StrictMode>
      <QueryWrapper>{children}</QueryWrapper>
    </StrictMode>
  );
  const cached = () =>
    queryClient.getQueryData<SessionDetails>(
      sessionKeys.details(DIALOGUE_SESSION_ID),
    );
  const render = () =>
    renderHook(() => useAnswerFlow(DIALOGUE_SESSION_ID), { wrapper });
  return { queryClient, cached, render };
}

export function withAnswered(...tail: ReturnType<typeof testUtterance>[]) {
  return testSessionDetails({
    utterances: [testUtterance(), PENDING, ...tail],
  });
}

export function analysisRequests(requests: { path: string }[]) {
  return requests.filter((request) => request.path.endsWith('/analysis'));
}
