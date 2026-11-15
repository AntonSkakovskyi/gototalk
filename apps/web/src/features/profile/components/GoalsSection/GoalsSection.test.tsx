import { ERROR_CODES } from '@gototalk/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import uk from '@/shared/i18n/uk.json';
import { mockApi } from '@/shared/testing/mock-api';
import { errorResponse, jsonResponse } from '@/shared/testing/http-responses';
import {
  FLUENT,
  INTERVIEW,
  MEETINGS,
  TRAVEL,
  counterText,
  fill,
  goalButton,
  goalItem,
  listedTitles,
  renderGoals,
  stubGoals,
  text,
} from '@/features/profile/testing/goals-test-helpers';

describe('GoalsSection list', () => {
  it('[TC-02-03] lists active goals first, then done ones, with status and counter', async () => {
    stubGoals([TRAVEL, FLUENT, MEETINGS]);
    renderGoals();

    expect(await screen.findByText(FLUENT.title)).toBeInTheDocument();

    expect(listedTitles()).toEqual([
      FLUENT.title,
      MEETINGS.title,
      TRAVEL.title,
    ]);
    expect(
      within(goalItem(FLUENT.title)).getByText(text.status.active),
    ).toBeInTheDocument();
    expect(
      within(goalItem(TRAVEL.title)).getByText(text.status.done),
    ).toBeInTheDocument();
    expect(screen.getByText(counterText(2))).toBeInTheDocument();
  });

  it('[TC-02-03] shows an explanation instead of a list when there are no goals', async () => {
    stubGoals([]);
    renderGoals();

    expect(await screen.findByText(text.empty)).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.getByText(counterText(0))).toBeInTheDocument();
    expect(screen.getByLabelText(text.add.label)).toBeEnabled();
  });

  it('[TC-02-03] announces loading and then shows the goals', async () => {
    stubGoals([FLUENT]);
    renderGoals();

    expect(
      screen.getByRole('status', { name: uk.common.loading }),
    ).toBeInTheDocument();
    expect(await screen.findByText(FLUENT.title)).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('[TC-02-03] shows an error with retry and recovers on retry', async () => {
    const user = userEvent.setup();
    let failing = true;
    mockApi({
      'GET /api/goals': () =>
        failing ? errorResponse(500, 'INTERNAL_ERROR') : jsonResponse([FLUENT]),
    });
    renderGoals();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.errors.generic,
    );

    failing = false;
    await user.click(
      screen.getByRole('button', { name: uk.common.actions.retry }),
    );

    expect(await screen.findByText(FLUENT.title)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('GoalsSection status changes', () => {
  it('[TC-02-03] marks a goal done and moves it below the active ones', async () => {
    const user = userEvent.setup();
    const { requests } = stubGoals([FLUENT, MEETINGS]);
    renderGoals();
    await screen.findByText(FLUENT.title);

    await user.click(goalButton('markDoneLabel', FLUENT.title));

    expect(await screen.findByText(counterText(1))).toBeInTheDocument();
    expect(listedTitles()).toEqual([MEETINGS.title, FLUENT.title]);
    const patch = requests.find(({ method }) => method === 'PATCH');
    expect(patch?.path).toBe(`/api/goals/${FLUENT.id}`);
    expect(patch?.body).toEqual({ status: 'done' });
  });

  it('[TC-02-03] reopens a done goal', async () => {
    const user = userEvent.setup();
    const { requests } = stubGoals([FLUENT, TRAVEL]);
    renderGoals();
    await screen.findByText(TRAVEL.title);

    await user.click(goalButton('reopenLabel', TRAVEL.title));

    expect(await screen.findByText(counterText(2))).toBeInTheDocument();
    expect(requests.find(({ method }) => method === 'PATCH')?.body).toEqual({
      status: 'active',
    });
  });

  it('[TC-02-03] shows the server limit message when reopening at the limit', async () => {
    const user = userEvent.setup();
    stubGoals([FLUENT, MEETINGS, INTERVIEW, TRAVEL], {
      [`PATCH /api/goals/${TRAVEL.id}`]: errorResponse(
        409,
        ERROR_CODES.ACTIVE_GOALS_LIMIT,
      ),
    });
    renderGoals();
    await screen.findByText(TRAVEL.title);

    await user.click(goalButton('reopenLabel', TRAVEL.title));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      fill(text.errors.limit, { max: 3 }),
    );
    expect(screen.getByText(counterText(3))).toBeInTheDocument();
    expect(
      within(goalItem(TRAVEL.title)).getByText(text.status.done),
    ).toBeInTheDocument();
  });

  it('[TC-02-03] refreshes the list when a goal is gone on the server', async () => {
    const user = userEvent.setup();
    let gone = false;
    mockApi({
      'GET /api/goals': () => jsonResponse(gone ? [] : [FLUENT]),
      [`PATCH /api/goals/${FLUENT.id}`]: () => {
        gone = true;
        return errorResponse(404, ERROR_CODES.GOAL_NOT_FOUND);
      },
    });
    renderGoals();
    await screen.findByText(FLUENT.title);

    await user.click(goalButton('markDoneLabel', FLUENT.title));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      text.errors.notFound,
    );
    expect(await screen.findByText(text.empty)).toBeInTheDocument();
  });
});
