import {
  ERROR_CODES,
  type PlanSessionRequest,
  type SessionPlan,
} from '@gototalk/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import uk from '@/shared/i18n/uk.json';
import { mockApi } from '@/shared/testing/mock-api';
import {
  errorResponse,
  jsonResponse,
  testSessionDetails,
  testSessionPlan,
} from '@/shared/testing/test-fixtures';
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
  const { requests } = mockApi({
    'POST /api/sessions/plan': (request) =>
      planReply(request.body as PlanSessionRequest),
    'POST /api/sessions': () => jsonResponse(testSessionDetails(), 201),
  });
  renderWithProviders(<SessionProposal />);
  return {
    user: userEvent.setup(),
    planBodies: () =>
      requests
        .filter((request) => request.path === '/api/sessions/plan')
        .map((request) => request.body),
    startBodies: () =>
      requests
        .filter((request) => request.path === '/api/sessions')
        .map((request) => request.body),
  };
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
    const { user, planBodies } = setup();
    await heading('Suggested topic');
    expect(screen.queryByText(text.custom.badge)).not.toBeInTheDocument();

    await applyTopic(user, '  My cat  ');

    await heading('My cat');
    expect(planBodies()).toEqual([
      { previousTopics: [] },
      { previousTopics: [], customTopic: 'My cat' },
    ]);
    expect(screen.getByText(text.custom.badge)).toBeInTheDocument();
    const questions = within(
      screen.getByRole('list', { name: text.questionsLabel }),
    ).getAllByRole('listitem');
    expect(questions.map((item) => item.textContent)).toEqual(CUSTOM_QUESTIONS);
    expect(topicField()).not.toBeInTheDocument();
  });

  it('[TC-03-03] hides another topic while the own topic is active and returns to a suggestion', async () => {
    const { user, planBodies } = setup();
    await heading('Suggested topic');
    await applyTopic(user, 'My cat');
    await heading('My cat');

    expect(another()).not.toBeInTheDocument();

    await user.click(back());

    const suggested = await heading('Suggested topic');
    await waitFor(() => expect(suggested).toHaveFocus());
    expect(planBodies().at(-1)).toEqual({ previousTopics: [] });
    expect(screen.queryByText(text.custom.badge)).not.toBeInTheDocument();
    expect(another()).toBeEnabled();
  });

  it('[TC-03-03] cancel closes the form without a request and returns focus to the opener', async () => {
    const { user, planBodies } = setup();
    await heading('Suggested topic');
    await user.click(opener());
    expect(topicField()).toHaveFocus();

    await user.click(screen.getByRole('button', { name: text.custom.cancel }));

    expect(topicField()).not.toBeInTheDocument();
    await waitFor(() => expect(opener()).toHaveFocus());
    expect(planBodies()).toHaveLength(1);
  });

  it('[TC-03-03] returns focus to the opener after a topic is applied', async () => {
    const { user } = setup();
    await heading('Suggested topic');

    await applyTopic(user, 'My cat');

    await heading('My cat');
    await waitFor(() => expect(opener()).toHaveFocus());
  });

  it('[TC-03-03] starts with the custom topic source, its text and the chosen feedback mode', async () => {
    const { user, startBodies } = setup();
    await heading('Suggested topic');
    await applyTopic(user, 'My cat');
    await heading('My cat');
    await user.click(
      screen.getByRole('radio', { name: text.feedbackMode.deferred }),
    );

    await user.click(screen.getByRole('button', { name: text.start }));

    await waitFor(() => expect(startBodies()).toHaveLength(1));
    expect(startBodies()[0]).toEqual({
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
