import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { uk } from '@/shared/i18n/resources';
import { mockApi } from '@/shared/testing/mock-api';
import {
  EMPTY_LEARNER_MODEL,
  TEST_PROFILE,
  TOP_FIVE_LEARNER_MODEL,
  testGoal,
} from '@/shared/testing/fixtures/profile';
import { TEST_USER } from '@/shared/testing/fixtures/auth';
import { errorResponse, jsonResponse } from '@/shared/testing/http-responses';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { ProfilePage } from './ProfilePage';

const PROFILE = {
  ...TEST_PROFILE,
  scenes: ['work_meetings', 'Travel for work'],
};
const ACTIVE_GOAL = testGoal({ title: 'Speak fluently' });
const DONE_GOAL = testGoal({
  id: '5d1c9a52-8a35-4e0e-9a0c-1f0d6c2b0002',
  title: 'Pass an interview',
  status: 'done',
});

function renderPage() {
  return renderWithProviders(<ProfilePage />, {
    session: {
      accessToken: 'access-1',
      user: { ...TEST_USER, consentAt: '2026-01-01T10:00:00.000Z' },
    },
  });
}

describe('ProfilePage', () => {
  it('[TC-02-03] shows the level, preset and custom scenes, goals, learner model and the account section', async () => {
    mockApi({
      'GET /api/profile': jsonResponse(PROFILE),
      'GET /api/goals': jsonResponse([DONE_GOAL, ACTIVE_GOAL]),
      'GET /api/profile/learner-model': jsonResponse(TOP_FIVE_LEARNER_MODEL),
    });
    renderPage();

    expect(
      screen.getByRole('heading', { level: 1, name: uk.pages.profile.title }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(uk.profile.levels.B1.title),
    ).toBeInTheDocument();
    expect(
      screen.getByText(uk.profile.scenes.presets.work_meetings),
    ).toBeInTheDocument();
    expect(screen.getByText('Travel for work')).toBeInTheDocument();
    expect(await screen.findByText(ACTIVE_GOAL.title)).toBeInTheDocument();
    expect(screen.getByText(DONE_GOAL.title)).toBeInTheDocument();
    expect(
      await screen.findByText(uk.mistakeCategories.articles),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: uk.pages.profile.account.title,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(TEST_USER.email)).toBeInTheDocument();
  });

  it('[TC-02-03] names every section with a heading', async () => {
    mockApi({
      'GET /api/profile': jsonResponse(PROFILE),
      'GET /api/goals': jsonResponse([]),
      'GET /api/profile/learner-model': jsonResponse(EMPTY_LEARNER_MODEL),
    });
    renderPage();

    await screen.findByText(uk.profile.goals.empty);

    for (const name of [
      uk.profile.details.title,
      uk.profile.goals.title,
      uk.profile.learnerModel.title,
      uk.pages.profile.account.title,
    ]) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument();
    }
  });

  it('[TC-02-03] shows loading placeholders for every section', () => {
    mockApi({
      'GET /api/profile': jsonResponse(PROFILE),
      'GET /api/goals': jsonResponse([]),
      'GET /api/profile/learner-model': jsonResponse(EMPTY_LEARNER_MODEL),
    });
    renderPage();

    expect(
      screen.getAllByRole('status', { name: uk.common.loading }),
    ).toHaveLength(3);
  });

  it('[TC-02-03] shows an error with retry only for the section that failed', async () => {
    const user = userEvent.setup();
    let failing = true;
    mockApi({
      'GET /api/profile': () =>
        failing
          ? errorResponse(404, 'PROFILE_NOT_FOUND')
          : jsonResponse(PROFILE),
      'GET /api/goals': jsonResponse([ACTIVE_GOAL]),
      'GET /api/profile/learner-model': jsonResponse(EMPTY_LEARNER_MODEL),
    });
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.errors.generic,
    );
    expect(await screen.findByText(ACTIVE_GOAL.title)).toBeInTheDocument();

    failing = false;
    await user.click(
      screen.getByRole('button', { name: uk.common.actions.retry }),
    );

    expect(
      await screen.findByText(uk.profile.levels.B1.title),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
