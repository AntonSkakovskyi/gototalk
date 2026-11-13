import {
  ERROR_CODES,
  MAX_TOPIC_REROLLS,
  type PlanSessionRequest,
} from '@gototalk/shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import { sessionKeys } from '@/features/session/api/session-queries';
import { mockApi } from '@/shared/testing/mock-api';
import {
  createQueryWrapper,
  createTestQueryClient,
} from '@/shared/testing/query-wrapper';
import {
  errorResponse,
  jsonResponse,
  testSessionDetails,
  testSessionPlan,
} from '@/shared/testing/test-fixtures';
import { useSessionProposal } from './use-session-proposal';

function planFor({ previousTopics, customTopic }: PlanSessionRequest) {
  if (customTopic !== undefined) {
    return testSessionPlan({ topic: customTopic, topicSource: 'custom' });
  }
  return testSessionPlan({ topic: `Topic ${previousTopics.length}` });
}

const startOk = () => jsonResponse(testSessionDetails(), 201);

function setup(startReply: () => Response = () => startOk()) {
  const { requests } = mockApi({
    'POST /api/sessions/plan': (request) =>
      jsonResponse(planFor(request.body as PlanSessionRequest)),
    'POST /api/sessions': startReply,
  });
  const queryClient = createTestQueryClient();
  const render = () =>
    renderHook(() => useSessionProposal(), {
      wrapper: createQueryWrapper(queryClient),
    });
  const { result, unmount } = render();
  const planRequests = () =>
    requests.filter((request) => request.path === '/api/sessions/plan');
  const cachedFirstPlan = () =>
    queryClient.getQueryCache().find({
      queryKey: sessionKeys.plan({ previousTopics: [] }),
    });
  return { result, requests, planRequests, unmount, render, cachedFirstPlan };
}

describe('useSessionProposal', () => {
  it('[TC-03-03] loads the first plan with no previous topics', async () => {
    const { result, planRequests } = setup();

    await waitFor(() =>
      expect(result.current.plan.data?.topic).toBe('Topic 0'),
    );

    expect(planRequests().map((request) => request.body)).toEqual([
      { previousTopics: [] },
    ]);
    expect(result.current.feedbackMode).toBe('immediate');
    expect(result.current.canReroll).toBe(true);
    expect(result.current.rerolls).toBe(0);
    expect(result.current.maxRerolls).toBe(MAX_TOPIC_REROLLS);
  });

  it('[TC-03-03] another topic requests a plan excluding the shown topic', async () => {
    const { result, planRequests } = setup();
    await waitFor(() =>
      expect(result.current.plan.data?.topic).toBe('Topic 0'),
    );

    act(() => result.current.requestAnotherTopic());

    await waitFor(() =>
      expect(result.current.plan.data?.topic).toBe('Topic 1'),
    );
    expect(planRequests()[1]?.body).toEqual({ previousTopics: ['Topic 0'] });
    expect(result.current.rerolls).toBe(1);
  });

  it('[TC-03-03] allows exactly the maximum number of rerolls', async () => {
    const { result, planRequests } = setup();
    await waitFor(() =>
      expect(result.current.plan.data?.topic).toBe('Topic 0'),
    );

    for (let reroll = 1; reroll <= MAX_TOPIC_REROLLS; reroll += 1) {
      act(() => result.current.requestAnotherTopic());
      await waitFor(() =>
        expect(result.current.plan.data?.topic).toBe(`Topic ${reroll}`),
      );
    }

    expect(result.current.canReroll).toBe(false);
    act(() => result.current.requestAnotherTopic());
    expect(result.current.rerolls).toBe(MAX_TOPIC_REROLLS);
    expect(result.current.plan.data?.topic).toBe(`Topic ${MAX_TOPIC_REROLLS}`);
    expect(planRequests()).toHaveLength(MAX_TOPIC_REROLLS + 1);
  });

  it('[TC-03-03] a custom topic is requested as is and blocks rerolls', async () => {
    const { result, planRequests } = setup();
    await waitFor(() =>
      expect(result.current.plan.data?.topic).toBe('Topic 0'),
    );

    act(() => result.current.applyCustomTopic('  My own topic  '));

    await waitFor(() =>
      expect(result.current.plan.data?.topicSource).toBe('custom'),
    );
    expect(planRequests()[1]?.body).toEqual({
      previousTopics: [],
      customTopic: 'My own topic',
    });
    expect(result.current.customTopic).toBe('My own topic');
    expect(result.current.canReroll).toBe(false);
  });

  it('[TC-03-03] a blank custom topic is ignored', async () => {
    const { result, planRequests } = setup();
    await waitFor(() =>
      expect(result.current.plan.data?.topic).toBe('Topic 0'),
    );

    act(() => result.current.applyCustomTopic('   '));

    expect(result.current.customTopic).toBeUndefined();
    expect(planRequests()).toHaveLength(1);
  });

  it('[TC-03-03] clearing the custom topic requests a suggestion again with the last previous topics', async () => {
    const { result, planRequests } = setup();
    await waitFor(() =>
      expect(result.current.plan.data?.topic).toBe('Topic 0'),
    );
    act(() => result.current.requestAnotherTopic());
    await waitFor(() =>
      expect(result.current.plan.data?.topic).toBe('Topic 1'),
    );
    act(() => result.current.applyCustomTopic('My own topic'));
    await waitFor(() =>
      expect(result.current.plan.data?.topicSource).toBe('custom'),
    );

    act(() => result.current.clearCustomTopic());

    await waitFor(() =>
      expect(result.current.plan.data?.topicSource).toBe('suggested'),
    );
    expect(planRequests().map((request) => request.body)).toEqual([
      { previousTopics: [] },
      { previousTopics: ['Topic 0'] },
      { previousTopics: ['Topic 0'], customTopic: 'My own topic' },
      { previousTopics: ['Topic 0'] },
    ]);
    expect(result.current.rerolls).toBe(1);
    expect(result.current.canReroll).toBe(true);
  });

  it('[TC-03-03] start sends exactly the shown plan and the chosen mode', async () => {
    const { result, requests } = setup();
    await waitFor(() =>
      expect(result.current.plan.data?.topic).toBe('Topic 0'),
    );
    act(() => result.current.requestAnotherTopic());
    await waitFor(() =>
      expect(result.current.plan.data?.topic).toBe('Topic 1'),
    );
    act(() => result.current.setFeedbackMode('deferred'));
    const onStarted = vi.fn();

    act(() => result.current.start(onStarted));

    await waitFor(() => expect(onStarted).toHaveBeenCalledOnce());
    const shown = testSessionPlan({ topic: 'Topic 1' });
    expect(requests.at(-1)?.body).toEqual({
      topic: shown.topic,
      topicSource: shown.topicSource,
      questions: shown.questions,
      feedbackMode: 'deferred',
    });
    expect(onStarted.mock.calls[0]?.[0]).toEqual(testSessionDetails());
  });

  it('[TC-03-03] start sends the default immediate mode', async () => {
    const { result, requests } = setup();
    await waitFor(() =>
      expect(result.current.plan.data?.topic).toBe('Topic 0'),
    );
    const onStarted = vi.fn();

    act(() => result.current.start(onStarted));

    await waitFor(() => expect(onStarted).toHaveBeenCalledOnce());
    expect(requests.at(-1)?.body).toMatchObject({ feedbackMode: 'immediate' });
  });

  it('[TC-03-03] requests a fresh plan when the proposal is left and entered again', async () => {
    const { result, unmount, render, planRequests, cachedFirstPlan } = setup();
    await waitFor(() =>
      expect(result.current.plan.data?.topic).toBe('Topic 0'),
    );

    unmount();
    await waitFor(() => expect(cachedFirstPlan()).toBeUndefined());
    const reentered = render();

    await waitFor(() =>
      expect(reentered.result.current.plan.data?.topic).toBe('Topic 0'),
    );
    expect(planRequests().map((request) => request.body)).toEqual([
      { previousTopics: [] },
      { previousTopics: [] },
    ]);
  });

  it('[TC-03-03] a start error is cleared when another topic is requested', async () => {
    const { result } = setup(() => errorResponse(500, 'INTERNAL_ERROR'));
    await waitFor(() =>
      expect(result.current.plan.data?.topic).toBe('Topic 0'),
    );
    act(() => result.current.start(vi.fn()));
    await waitFor(() => expect(result.current.startError).not.toBeNull());

    act(() => result.current.requestAnotherTopic());

    await waitFor(() => expect(result.current.startError).toBeNull());
  });

  it('[TC-03-03] a start error is cleared when the feedback mode changes', async () => {
    const { result } = setup(() =>
      errorResponse(403, ERROR_CODES.CONSENT_REQUIRED),
    );
    await waitFor(() =>
      expect(result.current.plan.data?.topic).toBe('Topic 0'),
    );
    act(() => result.current.start(vi.fn()));
    await waitFor(() => expect(result.current.startError).not.toBeNull());

    act(() => result.current.setFeedbackMode('deferred'));

    await waitFor(() => expect(result.current.startError).toBeNull());
  });
});
