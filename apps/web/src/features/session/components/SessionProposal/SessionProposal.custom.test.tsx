import {
  ERROR_CODES,
  type PlanSessionRequest,
  type SessionPlan,
} from '@gototalk/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { uk } from '@/shared/i18n/resources';
import { mockSessionApi } from '@/features/session/testing/session-mocks';
import { errorResponse, jsonResponse } from '@/shared/testing/http-responses';
import { testSessionPlan } from '@/shared/testing/fixtures/session';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { SessionProposal } from './SessionProposal';

const text = uk.session.proposal;
const CUSTOM_QUESTIONS = Array.from(
  { length: 5 },
  (_, index) => `Custom question ${index + 1}`,
);

function planFor({ customTopic }: PlanSessionRequest): SessionPlan {
  return customTopic === undefined
    ? testSessionPlan({ topic: 'Suggested topic' })
    : testSessionPlan({
        topic: customTopic,
        topicSource: 'custom',
        questions: CUSTOM_QUESTIONS,
      });
}

function setup(
  planReply: (body: PlanSessionRequest) => Response = (body) =>
    jsonResponse(planFor(body)),
) {
  const { planRequests, startRequests } = mockSessionApi({ plan: planReply });
  renderWithProviders(<SessionProposal />);
  return { user: userEvent.setup(), planRequests, startRequests };
}

type User = ReturnType<typeof userEvent.setup>;

const heading = (name: string) =>
  screen.findByRole('heading', { level: 2, name });
const opener = () => screen.getByRole('button', { name: text.custom.open });
const back = () => screen.getByRole('button', { name: text.custom.back });
const another = () => screen.queryByRole('button', { name: text.anotherTopic });
const topicField = () =>
  screen.queryByRole('textbox', { name: text.custom.label });

async function applyTopic(user: User, topic: string) {
  await user.click(opener());
  await user.type(
    screen.getByRole('textbox', { name: text.custom.label }),
    `${topic}{Enter}`,
  );
}

describe('SessionProposal custom topic', () => {
  it('[TC-03-03] requests a plan for the typed topic and shows its questions with an own-topic indicator', async () => {
    const { user, planRequests } = setup();
    await heading('Suggested topic');
    expect(screen.queryByText(text.custom.badge)).not.toBeInTheDocument();

    await applyTopic(user, '  My cat  ');

    await heading('My cat');
    expect(planRequests()).toEqual([
      { previousTopics: [] },
      { previousTopics: [], customTopic: 'My cat' },
    ]);
    expect(screen.getByText(text.custom.badge)).toBeInTheDocument();
    const questions = within(
      screen.getByRole('list', { name: text.questionsLabel }),
    ).getAllByRole('listitem');
    expect(questions.map((item) => item.textContent)).toEqual(CUSTOM_QUESTIONS);
    expect(
      screen.getByRole('heading', { level: 2, name: 'My cat' }),
    ).not.toHaveAttribute('lang');
    expect(
      screen.getByRole('list', { name: text.questionsLabel }),
    ).toHaveAttribute('lang', 'en');
    expect(topicField()).not.toBeInTheDocument();
  });

  it('[TC-03-03] hides another topic while the own topic is active and returns to a suggestion', async () => {
    const { user, planRequests } = setup();
    await heading('Suggested topic');
    await applyTopic(user, 'My cat');
    await heading('My cat');

    expect(another()).not.toBeInTheDocument();

    await user.click(back());

    const suggested = await heading('Suggested topic');
    await waitFor(() => expect(suggested).toHaveFocus());
    expect(planRequests().at(-1)).toEqual({ previousTopics: [] });
    expect(screen.queryByText(text.custom.badge)).not.toBeInTheDocument();
    expect(another()).toBeEnabled();
  });

  it('[TC-03-03] cancel closes the form without a request and returns focus to the opener', async () => {
    const { user, planRequests } = setup();
    await heading('Suggested topic');
    await user.click(opener());
    expect(topicField()).toHaveFocus();

    await user.click(
      screen.getByRole('button', { name: uk.common.actions.cancel }),
    );

    expect(topicField()).not.toBeInTheDocument();
    await waitFor(() => expect(opener()).toHaveFocus());
    expect(planRequests()).toHaveLength(1);
  });

  it('[TC-03-03] moves focus to the new topic heading after a topic is applied', async () => {
    const { user } = setup();
    await heading('Suggested topic');

    await applyTopic(user, 'My cat');

    const applied = await heading('My cat');
    await waitFor(() => expect(applied).toHaveFocus());
    expect(opener()).not.toHaveFocus();
  });

  it('[TC-03-03] starts with the custom topic source, its text and the chosen feedback mode', async () => {
    const { user, startRequests } = setup();
    await heading('Suggested topic');
    await applyTopic(user, 'My cat');
    await heading('My cat');
    await user.click(
      screen.getByRole('radio', { name: text.feedbackMode.deferred }),
    );

    await user.click(screen.getByRole('button', { name: text.start }));

    await waitFor(() => expect(startRequests()).toHaveLength(1));
    expect(startRequests()[0]).toEqual({
      topic: 'My cat',
      topicSource: 'custom',
      questions: CUSTOM_QUESTIONS,
      feedbackMode: 'deferred',
    });
  });

  it('[TC-03-03] shows the plan error with a working retry when the custom plan fails', async () => {
    let failing = true;
    const { user } = setup((body) =>
      body.customTopic !== undefined && failing
        ? errorResponse(502, ERROR_CODES.LANGUAGE_MODEL_INVALID_RESPONSE)
        : jsonResponse(planFor(body)),
    );
    await heading('Suggested topic');

    await applyTopic(user, 'My cat');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.session.errors.planUnavailable,
    );
    expect(screen.getByRole('button', { name: text.start })).toBeDisabled();
    expect(back()).toBeEnabled();

    failing = false;
    await user.click(
      screen.getByRole('button', { name: uk.common.actions.retry }),
    );

    await heading('My cat');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
