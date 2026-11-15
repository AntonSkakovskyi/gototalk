import { screen } from '@testing-library/react';
import {
  currentLocation,
  renderAppWithProbe,
} from '@/app/testing/guard-test-helpers';
import { uk } from '@/shared/i18n/resources';
import { mockApi } from '@/shared/testing/mock-api';
import { TEST_PROFILE } from '@/shared/testing/fixtures/profile';
import { TEST_USER } from '@/shared/testing/fixtures/auth';
import { jsonResponse } from '@/shared/testing/http-responses';
import { testSessionPlan } from '@/shared/testing/fixtures/session';

const SESSION = {
  accessToken: 'access-1',
  user: { ...TEST_USER, consentAt: '2026-01-01T10:00:00.000Z' },
};

describe('NewSessionPage route', () => {
  it('[TC-03-03] sends an anonymous visitor to the login page', async () => {
    mockApi({});

    renderAppWithProbe({ route: '/sessions/new', session: 'anonymous' });

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: uk.auth.login.title,
      }),
    ).toBeInTheDocument();
    expect(currentLocation()).toBe('/login');
  });

  it('[TC-03-03] shows the proposal to a consented user with a profile', async () => {
    mockApi({
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
      await screen.findByRole('heading', {
        level: 2,
        name: testSessionPlan().topic,
      }),
    ).toBeInTheDocument();
    expect(currentLocation()).toBe('/sessions/new');
  });
});
