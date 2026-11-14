import { act, waitFor } from '@testing-library/react';
import { sessionKeys } from '@/shared/api/session-details';
import {
  DIALOGUE_SESSION_ID,
  analysisOk,
  mockDialogueApi,
} from '@/shared/testing/dialogue-mocks';
import {
  ANSWER_TEXT,
  PENDING,
  TURN,
  analysisRequests,
  deferred,
  setup,
  withAnswered,
} from '@/shared/testing/answer-flow-setup';
import {
  jsonResponse,
  testSessionDetails,
  testUtterance,
} from '@/shared/testing/test-fixtures';

const DETAILS_KEY = sessionKeys.details(DIALOGUE_SESSION_ID);

describe('useAnswerFlow with a details refetch in flight', () => {
  it('[TC-04-04] a late refetch response does not overwrite the stored answer', async () => {
    const { queryClient, cached, render } = setup();
    const staleDetails = deferred();
    mockDialogueApi({ details: () => staleDetails.promise });
    const { result } = render();
    act(() => {
      void queryClient.refetchQueries({ queryKey: DETAILS_KEY });
    });
    await waitFor(() =>
      expect(queryClient.isFetching({ queryKey: DETAILS_KEY })).toBe(1),
    );

    await act(async () => {
      await result.current.submit(ANSWER_TEXT);
    });
    await waitFor(() => expect(result.current.phase).toBe('idle'));
    staleDetails.resolve(jsonResponse(testSessionDetails()));
    await act(async () => undefined);

    expect(cached()?.utterances).toEqual([
      testUtterance(),
      TURN.utterance,
      TURN.reply,
    ]);
  });

  it('[TC-04-04] a refetch started during the analysis does not overwrite the turn result', async () => {
    const { queryClient, cached, render } = setup();
    const analysis = deferred();
    const staleDetails = deferred();
    mockDialogueApi({
      analyze: () => analysis.promise,
      details: () => staleDetails.promise,
    });
    const { result } = render();
    act(() => {
      void result.current.submit(ANSWER_TEXT);
    });
    await waitFor(() => expect(result.current.phase).toBe('analyzing'));
    act(() => {
      void queryClient.refetchQueries({ queryKey: DETAILS_KEY });
    });
    await waitFor(() =>
      expect(queryClient.isFetching({ queryKey: DETAILS_KEY })).toBe(1),
    );

    analysis.resolve(analysisOk());
    await waitFor(() => expect(result.current.phase).toBe('idle'));
    staleDetails.resolve(jsonResponse(withAnswered()));
    await act(async () => undefined);

    expect(cached()?.utterances).toEqual([
      testUtterance(),
      TURN.utterance,
      TURN.reply,
    ]);
  });

  it('[TC-04-08] sends exactly one analysis when a refetch delivers the new utterance before step 1 settles', async () => {
    const { queryClient, render } = setup();
    const answer = deferred();
    const api = mockDialogueApi({
      answer: () => answer.promise,
      details: () => jsonResponse(withAnswered()),
    });
    const { result } = render();
    act(() => {
      void result.current.submit(ANSWER_TEXT);
    });
    await waitFor(() => expect(result.current.phase).toBe('sending'));
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: DETAILS_KEY });
    });
    await waitFor(() => expect(analysisRequests(api.requests)).toHaveLength(1));

    answer.resolve(jsonResponse(PENDING, 201));
    await waitFor(() => expect(result.current.phase).toBe('idle'));
    await act(async () => undefined);

    expect(analysisRequests(api.requests)).toHaveLength(1);
  });
});
