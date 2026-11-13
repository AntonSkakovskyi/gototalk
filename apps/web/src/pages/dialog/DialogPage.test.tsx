import { ERROR_CODES } from '@gototalk/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  currentLocation,
  renderAppWithProbe,
} from '@/app/router/guards/guard-test-helpers';
import uk from '@/shared/i18n/uk.json';
import { mockApi } from '@/shared/testing/mock-api';
import {
  TEST_PROFILE,
  TEST_USER,
  errorResponse,
  jsonResponse,
  testSessionDetails,
  testSessionPlan,
} from '@/shared/testing/test-fixtures';

const SESSION = {
  accessToken: 'access-1',
  user: { ...TEST_USER, consentAt: '2026-01-01T10:00:00.000Z' },
};
const STARTED = testSessionDetails({
  id: '7c2e8b64-5f0a-4d1b-8e3a-2a9b4c6d0099',
  utterances: [
    {
      id: '9e4a1c73-6b2d-4f8a-a1c5-3b7d5e8f0099',
      seq: 1,
      role: 'assistant',
      text: 'Which part of the offsite are you most excited about?',
    },
  ],
});
const FIRST_QUESTION = STARTED.utterances[0]!.text;

describe('DialogPage route', () => {
  it('[TC-03-03] sends an anonymous visitor to the login page', async () => {
    mockApi({});

    renderAppWithProbe({
      route: `/sessions/${STARTED.id}`,
      session: 'anonymous',
    });

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: uk.auth.login.title,
      }),
    ).toBeInTheDocument();
    expect(currentLocation()).toBe('/login');
  });

  it('[TC-03-03] opens the session by the id from the route', async () => {
    mockApi({
      'GET /api/profile': jsonResponse(TEST_PROFILE),
      [`GET /api/sessions/${STARTED.id}`]: jsonResponse(STARTED),
    });

    renderAppWithProbe({ route: `/sessions/${STARTED.id}`, session: SESSION });

    expect(
      await screen.findByRole('heading', { level: 1, name: STARTED.topic }),
    ).toBeInTheDocument();
    expect(screen.getByText(FIRST_QUESTION)).toBeInTheDocument();
    expect(currentLocation()).toBe(`/sessions/${STARTED.id}`);
  });

  it.each([
    ['a random uuid', '00000000-0000-4000-8000-0000000000ff'],
    ['a non-uuid id', 'not-a-uuid'],
  ])('[TC-03-03] shows the not-found message for %s', async (_name, id) => {
    mockApi({
      'GET /api/profile': jsonResponse(TEST_PROFILE),
      [`GET /api/sessions/${id}`]: errorResponse(
        404,
        ERROR_CODES.SESSION_NOT_FOUND,
      ),
    });

    renderAppWithProbe({ route: `/sessions/${id}`, session: SESSION });

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: uk.session.errors.notFound,
      }),
    ).toBeInTheDocument();
  });

  it('[TC-03-03] keeps /sessions/new on the proposal, not on a session page', async () => {
    const { requests } = mockApi({
      'GET /api/profile': jsonResponse(TEST_PROFILE),
      'POST /api/sessions/plan': jsonResponse(testSessionPlan()),
    });

    renderAppWithProbe({ route: '/sessions/new', session: SESSION });

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: uk.pages.newSession.title,
      }),
    ).toBeInTheDocument();
    expect(
      requests.some((request) => request.path === '/api/sessions/new'),
    ).toBe(false);
  });

  it('[TC-03-03] start flow lands on the new session with the first question and no extra GET', async () => {
    const user = userEvent.setup();
    const { requests } = mockApi({
      'GET /api/profile': jsonResponse(TEST_PROFILE),
      'POST /api/sessions/plan': jsonResponse(testSessionPlan()),
      'POST /api/sessions': jsonResponse(STARTED, 201),
    });

    renderAppWithProbe({ route: '/sessions/new', session: SESSION });
    await user.click(
      await screen.findByRole('button', { name: uk.session.proposal.start }),
    );

    expect(await screen.findByText(FIRST_QUESTION)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: STARTED.topic }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(currentLocation()).toBe(`/sessions/${STARTED.id}`),
    );
    expect(
      requests.filter(
        (request) =>
          request.method === 'POST' && request.path === '/api/sessions',
      ),
    ).toHaveLength(1);
    expect(
      requests.filter(
        (request) =>
          request.method === 'GET' && request.path.startsWith('/api/sessions/'),
      ),
    ).toHaveLength(0);
  });
});
