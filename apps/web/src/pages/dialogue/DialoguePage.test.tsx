import { ERROR_CODES } from '@gototalk/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  currentLocation,
  renderAppWithProbe,
} from '@/app/testing/guard-test-helpers';
import { uk } from '@/shared/i18n/resources';
import { mockApi } from '@/shared/testing/mock-api';
import { STARTED_SESSION } from '@/features/session/testing/session-mocks';
import { TEST_PROFILE } from '@/shared/testing/fixtures/profile';
import { TEST_USER } from '@/shared/testing/fixtures/auth';
import { errorResponse, jsonResponse } from '@/shared/testing/http-responses';
import { testSessionPlan } from '@/shared/testing/fixtures/session';

const SESSION = {
  accessToken: 'access-1',
  user: { ...TEST_USER, consentAt: '2026-01-01T10:00:00.000Z' },
};
const FIRST_QUESTION = STARTED_SESSION.utterances[0]!.text;

describe('DialoguePage route', () => {
  it('[TC-03-03] sends an anonymous visitor to the login page', async () => {
    mockApi({});

    renderAppWithProbe({
      route: `/sessions/${STARTED_SESSION.id}`,
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
      [`GET /api/sessions/${STARTED_SESSION.id}`]:
        jsonResponse(STARTED_SESSION),
    });

    renderAppWithProbe({
      route: `/sessions/${STARTED_SESSION.id}`,
      session: SESSION,
    });

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: STARTED_SESSION.topic,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(FIRST_QUESTION)).toBeInTheDocument();
    expect(screen.getByText(uk.dialogue.turns.currentQuestion)).toBeVisible();
    expect(screen.getByLabelText(uk.dialogue.form.label)).toHaveAttribute(
      'lang',
      'en',
    );
    expect(
      screen.queryByText(uk.dialogue.planExhausted),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: uk.common.actions.home }),
    ).toHaveAttribute('href', '/');
    expect(currentLocation()).toBe(`/sessions/${STARTED_SESSION.id}`);
  });

  it('[TC-03-03] offers the home link while the session is loading', async () => {
    mockApi({
      'GET /api/profile': jsonResponse(TEST_PROFILE),
      [`GET /api/sessions/${STARTED_SESSION.id}`]: () =>
        new Promise<Response>(() => undefined),
    });

    renderAppWithProbe({
      route: `/sessions/${STARTED_SESSION.id}`,
      session: SESSION,
    });

    expect(
      await screen.findByRole('link', { name: uk.common.actions.home }),
    ).toHaveAttribute('href', '/');
    expect(
      screen.queryByLabelText(uk.dialogue.form.label),
    ).not.toBeInTheDocument();
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
    expect(
      screen.getByRole('link', { name: uk.common.actions.home }),
    ).toHaveAttribute('href', '/');
    expect(
      screen.queryByLabelText(uk.dialogue.form.label),
    ).not.toBeInTheDocument();
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
      'POST /api/sessions': jsonResponse(STARTED_SESSION, 201),
    });

    renderAppWithProbe({ route: '/sessions/new', session: SESSION });
    await user.click(
      await screen.findByRole('button', { name: uk.session.proposal.start }),
    );

    expect(await screen.findByText(FIRST_QUESTION)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: STARTED_SESSION.topic }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(currentLocation()).toBe(`/sessions/${STARTED_SESSION.id}`),
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
