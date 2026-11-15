import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import uk from '@/shared/i18n/uk.json';
import { mockApi } from '@/shared/testing/mock-api';
import { TEST_PROFILE, testGoal } from '@/shared/testing/fixtures/profile';
import { errorResponse, jsonResponse } from '@/shared/testing/http-responses';
import {
  button,
  goalField,
  reachGoals,
  renderWizard,
  stubGoalsApi,
  text,
} from './wizard-test-helpers';

describe('OnboardingWizard submission', () => {
  it('[TC-02-03] creates goals, saves the profile last and reports completion', async () => {
    const user = userEvent.setup();
    const { requests } = stubGoalsApi(() => jsonResponse(TEST_PROFILE));
    const onCompleted = renderWizard();
    await reachGoals(user);
    await user.type(goalField(1), ' Speak fluently ');
    await user.click(button(text.goals.add));
    await user.type(goalField(2), 'Pass interviews');

    await user.click(button(uk.common.actions.finish));

    await waitFor(() => expect(onCompleted).toHaveBeenCalledTimes(1));
    expect(requests.map(({ method, path }) => `${method} ${path}`)).toEqual([
      'GET /api/goals',
      'POST /api/goals',
      'POST /api/goals',
      'PUT /api/profile',
    ]);
    expect(requests[1]?.body).toEqual({ title: 'Speak fluently' });
    expect(requests[2]?.body).toEqual({ title: 'Pass interviews' });
    expect(requests[3]?.body).toEqual({
      level: 'B1',
      scenes: ['work_meetings', 'Travel for work'],
    });
  });

  it('[TC-02-03] disables the buttons while saving', async () => {
    const user = userEvent.setup();
    let release: (response: Response) => void = () => undefined;
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const { requests } = mockApi({
      'GET /api/goals': jsonResponse([]),
      'POST /api/goals': jsonResponse(testGoal(), 201),
      'PUT /api/profile': () => pending,
    });
    const onCompleted = renderWizard();
    await reachGoals(user);
    await user.type(goalField(1), 'Speak fluently');

    await user.click(button(uk.common.actions.finish));

    await waitFor(() =>
      expect(requests.map(({ method }) => method)).toContain('PUT'),
    );
    expect(button(text.actions.back)).toBeDisabled();
    expect(button(uk.common.actions.finish)).toBeDisabled();

    release(jsonResponse(TEST_PROFILE));

    await waitFor(() => expect(onCompleted).toHaveBeenCalledTimes(1));
  });

  it('[TC-02-03] shows an alert on failure and retries without duplicating goals', async () => {
    const user = userEvent.setup();
    let puts = 0;
    const { requests } = stubGoalsApi(() => {
      puts += 1;
      return puts === 1
        ? errorResponse(500, 'INTERNAL_ERROR')
        : jsonResponse(TEST_PROFILE);
    });
    const onCompleted = renderWizard();
    await reachGoals(user);
    await user.type(goalField(1), 'Speak fluently');

    await user.click(button(uk.common.actions.finish));

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText(uk.errors.generic)).toBeInTheDocument();
    expect(onCompleted).not.toHaveBeenCalled();
    expect(goalField(1)).toHaveValue('Speak fluently');

    await user.click(button(uk.common.actions.retry));

    await waitFor(() => expect(onCompleted).toHaveBeenCalledTimes(1));
    expect(requests.filter(({ method }) => method === 'POST')).toHaveLength(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('[TC-02-03] keeps the retry label while the retry is pending', async () => {
    const user = userEvent.setup();
    let release: (response: Response) => void = () => undefined;
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    let puts = 0;
    const { requests } = stubGoalsApi(() => {
      puts += 1;
      return puts === 1 ? errorResponse(500, 'INTERNAL_ERROR') : pending;
    });
    const onCompleted = renderWizard();
    await reachGoals(user);
    await user.type(goalField(1), 'Speak fluently');
    await user.click(button(uk.common.actions.finish));
    await screen.findByRole('alert');

    await user.click(button(uk.common.actions.retry));

    await waitFor(() =>
      expect(requests.filter(({ method }) => method === 'PUT')).toHaveLength(2),
    );
    expect(button(uk.common.actions.retry)).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: uk.common.actions.finish }),
    ).toBeNull();

    release(jsonResponse(TEST_PROFILE));
    await waitFor(() => expect(onCompleted).toHaveBeenCalledTimes(1));
  });
});
