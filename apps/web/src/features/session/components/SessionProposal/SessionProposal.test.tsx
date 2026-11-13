import {
  ERROR_CODES,
  MAX_TOPIC_REROLLS,
  type PlanSessionRequest,
} from '@gototalk/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { Route, Routes } from 'react-router';
import { sessionKeys } from '@/features/session/api/session-queries';
import uk from '@/shared/i18n/uk.json';
import { LocationProbe } from '@/shared/testing/LocationProbe';
import { mockApi, type MockRequest } from '@/shared/testing/mock-api';
import { createTestQueryClient } from '@/shared/testing/query-wrapper';
import {
  errorResponse,
  jsonResponse,
  testSessionDetails,
  testSessionPlan,
} from '@/shared/testing/test-fixtures';
import i18n from '@/shared/i18n/index';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { SessionProposal } from './SessionProposal';

const text = uk.session.proposal;
const STARTED = testSessionDetails({
  id: '7c2e8b64-5f0a-4d1b-8e3a-2a9b4c6d0099',
});

function planFor({ previousTopics }: PlanSessionRequest) {
  return jsonResponse(
    testSessionPlan({ topic: `Topic ${previousTopics.length}` }),
  );
}

function setup(startReply: () => Response | Promise<Response>) {
  const { requests } = mockApi({
    'POST /api/sessions/plan': (request) =>
      planFor(request.body as PlanSessionRequest),
    'POST /api/sessions': startReply,
  });
  const queryClient = createTestQueryClient();
  renderWithProviders(
    <StrictMode>
      <Routes>
        <Route path="/sessions/new" element={<SessionProposal />} />
        <Route path="*" element={null} />
      </Routes>
      <LocationProbe />
    </StrictMode>,
    { route: '/sessions/new', queryClient },
  );
  return {
    queryClient,
    requests,
    user: userEvent.setup(),
    planRequests: () =>
      requests.filter((request) => request.path === '/api/sessions/plan'),
    startRequests: () =>
      requests.filter((request) => request.path === '/api/sessions'),
  };
}

const startOk = () => jsonResponse(STARTED, 201);

function bodyOf(request: MockRequest | undefined) {
  return request?.body;
}

const startButton = () => screen.getByRole('button', { name: text.start });
const anotherButton = () =>
  screen.getByRole('button', { name: text.anotherTopic });

async function topic(name: string) {
  return screen.findByRole('heading', { level: 2, name });
}

describe('SessionProposal', () => {
  it('[TC-03-03] shows a loading state and then the topic with its five questions', async () => {
    setup(startOk);

    expect(
      screen.getByRole('status', { name: uk.common.loading }),
    ).toBeInTheDocument();
    expect(startButton()).toBeDisabled();

    await topic('Topic 0');
    const questions = within(
      screen.getByRole('list', { name: text.questionsLabel }),
    ).getAllByRole('listitem');

    expect(questions).toHaveLength(5);
    expect(questions[0]).toHaveTextContent(testSessionPlan().questions[0]!);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Topic 0' }),
    ).toHaveAttribute('lang', 'en');
    expect(
      screen.getByRole('list', { name: text.questionsLabel }),
    ).toHaveAttribute('lang', 'en');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(startButton()).toBeEnabled();
  });

  it('[TC-03-03] requests the first plan exactly once with no previous topics, even under StrictMode', async () => {
    const { planRequests } = setup(startOk);

    await topic('Topic 0');

    expect(planRequests().map(bodyOf)).toEqual([{ previousTopics: [] }]);
  });

  it('[TC-03-03] another topic requests a plan excluding the shown ones and moves focus to the new topic', async () => {
    const { user, planRequests } = setup(startOk);
    await topic('Topic 0');
    expect(
      screen.getByText(i18n.t('session.proposal.rerollsLeft', { left: 3 })),
    ).toBeInTheDocument();

    await user.click(anotherButton());

    const next = await topic('Topic 1');
    expect(planRequests().map(bodyOf)).toEqual([
      { previousTopics: [] },
      { previousTopics: ['Topic 0'] },
    ]);
    await waitFor(() => expect(next).toHaveFocus());
    expect(
      screen.getByText(i18n.t('session.proposal.rerollsLeft', { left: 2 })),
    ).toBeInTheDocument();
  });

  it('[TC-03-03] disables another topic after the maximum rerolls and sends no further request', async () => {
    const { user, planRequests } = setup(startOk);
    await topic('Topic 0');

    for (let reroll = 1; reroll <= MAX_TOPIC_REROLLS; reroll += 1) {
      await user.click(anotherButton());
      await topic(`Topic ${reroll}`);
    }
    await user.click(anotherButton());

    expect(anotherButton()).toBeDisabled();
    expect(screen.getByText(text.rerollsExhausted)).toBeInTheDocument();
    expect(anotherButton()).toHaveAccessibleDescription(text.rerollsExhausted);
    expect(planRequests()).toHaveLength(MAX_TOPIC_REROLLS + 1);
    expect(bodyOf(planRequests().at(-1))).toEqual({
      previousTopics: ['Topic 0', 'Topic 1', 'Topic 2'],
    });
  });

  it('[TC-03-05] offers a labelled mode switch with immediate as the default and starts with it', async () => {
    const { user, startRequests } = setup(startOk);
    await topic('Topic 0');

    const group = screen.getByRole('radiogroup', {
      name: text.feedbackMode.label,
    });
    expect(
      within(group).getByRole('radio', { name: text.feedbackMode.immediate }),
    ).toBeChecked();

    await user.click(startButton());

    await waitFor(() => expect(startRequests()).toHaveLength(1));
    expect(bodyOf(startRequests()[0])).toMatchObject({
      topic: 'Topic 0',
      topicSource: 'suggested',
      feedbackMode: 'immediate',
    });
  });

  it('[TC-03-05] the deferred mode is sent on start and the session page opens', async () => {
    const { user, startRequests } = setup(startOk);
    await topic('Topic 0');

    await user.click(
      screen.getByRole('radio', { name: text.feedbackMode.deferred }),
    );
    await user.click(startButton());

    await waitFor(() =>
      expect(screen.getByTestId('location-path')).toHaveTextContent(
        `/sessions/${STARTED.id}`,
      ),
    );
    expect(bodyOf(startRequests()[0])).toMatchObject({
      feedbackMode: 'deferred',
      questions: testSessionPlan().questions,
    });
  });

  it('[TC-03-03] shows the mapped message with a working retry when the plan fails', async () => {
    const user = userEvent.setup();
    let failing = true;
    mockApi({
      'POST /api/sessions/plan': () =>
        failing
          ? errorResponse(502, ERROR_CODES.LANGUAGE_MODEL_INVALID_RESPONSE)
          : jsonResponse(testSessionPlan({ topic: 'Recovered' })),
    });
    renderWithProviders(<SessionProposal />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.session.errors.planUnavailable,
    );
    expect(startButton()).toBeDisabled();

    failing = false;
    await user.click(
      screen.getByRole('button', { name: uk.common.actions.retry }),
    );

    expect(await topic('Recovered')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('[TC-03-03] shows the consent message when start is refused and lets the user retry', async () => {
    let refused = true;
    const { user, startRequests } = setup(() =>
      refused ? errorResponse(403, ERROR_CODES.CONSENT_REQUIRED) : startOk(),
    );
    await topic('Topic 0');

    await user.click(startButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.session.errors.consentRequired,
    );
    expect(startButton()).toBeEnabled();
    expect(screen.getByTestId('location-path')).toHaveTextContent(
      '/sessions/new',
    );

    refused = false;
    await user.click(startButton());

    await waitFor(() =>
      expect(screen.getByTestId('location-path')).toHaveTextContent(
        `/sessions/${STARTED.id}`,
      ),
    );
    expect(startRequests()).toHaveLength(2);
  });

  it('[TC-03-03] shows the generic message when start fails on the server', async () => {
    const { user } = setup(() => errorResponse(500, 'INTERNAL_ERROR'));
    await topic('Topic 0');

    await user.click(startButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.errors.generic,
    );
    expect(startButton()).toBeEnabled();
  });

  it('[TC-03-03] disables the controls while the session is starting', async () => {
    let finish: (response: Response) => void = () => {};
    const { user } = setup(
      () => new Promise<Response>((resolve) => (finish = resolve)),
    );
    await topic('Topic 0');

    await user.click(startButton());

    await waitFor(() => expect(startButton()).toBeDisabled());
    expect(startButton()).toHaveAttribute('data-loading', 'true');
    expect(anotherButton()).toBeDisabled();
    expect(
      screen.getByRole('radio', { name: text.feedbackMode.deferred }),
    ).toBeDisabled();

    finish(startOk());

    await waitFor(() =>
      expect(screen.getByTestId('location-path')).toHaveTextContent(
        `/sessions/${STARTED.id}`,
      ),
    );
  });

  it('[TC-03-03] drops the plan when the proposal is left', async () => {
    const { user, queryClient, planRequests } = setup(startOk);
    await topic('Topic 0');
    const firstPlan = sessionKeys.plan({ previousTopics: [] });
    expect(queryClient.getQueryData(firstPlan)).toBeDefined();

    await user.click(startButton());

    await waitFor(() =>
      expect(screen.getByTestId('location-path')).toHaveTextContent(
        '/sessions/' + STARTED.id,
      ),
    );
    await waitFor(() =>
      expect(queryClient.getQueryData(firstPlan)).toBeUndefined(),
    );
    expect(planRequests()).toHaveLength(1);
  });

  it('[TC-03-03] clears a start error when the feedback mode changes', async () => {
    const { user } = setup(() => errorResponse(500, 'INTERNAL_ERROR'));
    await topic('Topic 0');
    await user.click(startButton());
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await user.click(
      screen.getByRole('radio', { name: text.feedbackMode.deferred }),
    );

    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
    );
  });

  it('[TC-03-03] keeps the previous topics when another topic fails, offers a retry and keeps the count', async () => {
    const user = userEvent.setup();
    let failing = true;
    const { requests } = mockApi({
      'POST /api/sessions/plan': (request) => {
        const body = request.body as PlanSessionRequest;
        return failing && body.previousTopics.length === 1
          ? errorResponse(502, ERROR_CODES.LANGUAGE_MODEL_INVALID_RESPONSE)
          : planFor(body);
      },
    });
    renderWithProviders(<SessionProposal />);
    await topic('Topic 0');

    await user.click(anotherButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.session.errors.planUnavailable,
    );
    expect(startButton()).toBeDisabled();
    expect(anotherButton()).toBeDisabled();
    const retry = screen.getByRole('button', {
      name: uk.common.actions.retry,
    });
    await waitFor(() => expect(retry).toHaveFocus());

    failing = false;
    await user.click(retry);

    const next = await topic('Topic 1');
    await waitFor(() => expect(next).toHaveFocus());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('session.proposal.rerollsLeft', { left: 2 })),
    ).toBeInTheDocument();
    expect(requests.at(-1)?.body).toEqual({ previousTopics: ['Topic 0'] });
  });
});
