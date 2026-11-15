import { ERROR_CODES, MAX_TOPIC_REROLLS } from '@gototalk/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { Route, Routes } from 'react-router';
import { sessionKeys } from '@/entities/session/api/session-details';
import uk from '@/shared/i18n/uk.json';
import { LocationProbe } from '@/shared/testing/LocationProbe';
import { createTestQueryClient } from '@/shared/testing/query-wrapper';
import i18n from '@/shared/i18n/index';
import {
  STARTED_SESSION,
  mockSessionApi,
  planFor,
  startOk,
} from '@/shared/testing/session-mocks';
import { errorResponse, jsonResponse } from '@/shared/testing/http-responses';
import { testSessionPlan } from '@/shared/testing/fixtures/session';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { SessionProposal } from './SessionProposal';

const text = uk.session.proposal;

function setup(startReply?: () => Response | Promise<Response>) {
  const api = mockSessionApi({ start: startReply });
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
  return { ...api, queryClient, user: userEvent.setup() };
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

    expect(planRequests()).toEqual([{ previousTopics: [] }]);
  });

  it('[TC-03-03] another topic requests a plan excluding the shown ones and moves focus to the new topic', async () => {
    const { user, planRequests } = setup(startOk);
    await topic('Topic 0');
    expect(
      screen.getByText(i18n.t('session.proposal.rerollsLeft', { left: 3 })),
    ).toBeInTheDocument();

    await user.click(anotherButton());

    const next = await topic('Topic 1');
    expect(planRequests()).toEqual([
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
    expect(planRequests().at(-1)).toEqual({
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
    expect(startRequests()[0]).toMatchObject({
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
        `/sessions/${STARTED_SESSION.id}`,
      ),
    );
    expect(startRequests()[0]).toMatchObject({
      feedbackMode: 'deferred',
      questions: testSessionPlan().questions,
    });
  });

  it('[TC-03-03] shows the mapped message with a working retry when the plan fails', async () => {
    const user = userEvent.setup();
    let failing = true;
    mockSessionApi({
      plan: () =>
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
        `/sessions/${STARTED_SESSION.id}`,
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
        `/sessions/${STARTED_SESSION.id}`,
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
        '/sessions/' + STARTED_SESSION.id,
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
    const { planRequests } = mockSessionApi({
      plan: ({ previousTopics }) =>
        failing && previousTopics.length === 1
          ? errorResponse(502, ERROR_CODES.LANGUAGE_MODEL_INVALID_RESPONSE)
          : jsonResponse(planFor({ previousTopics })),
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
    expect(planRequests().at(-1)).toEqual({ previousTopics: ['Topic 0'] });
  });
});
