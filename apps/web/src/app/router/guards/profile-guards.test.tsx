import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { profileKeys } from '@/features/profile/api/profile-queries';
import {
  completeOnboarding,
  stubNewUserApi,
  text,
} from '@/features/profile/components/OnboardingWizard/wizard-test-helpers';
import uk from '@/shared/i18n/uk.json';
import { createTestQueryClient } from '@/shared/testing/query-wrapper';
import type { RenderOptions } from '@/shared/testing/test-utils';
import { mockApi } from '@/shared/testing/mock-api';
import {
  EMPTY_SESSIONS_ROUTE,
  TEST_PROFILE,
  TEST_USER,
  errorResponse,
  jsonResponse,
} from '@/shared/testing/test-fixtures';
import {
  currentLocation,
  heading,
  renderAppWithProbe,
} from './guard-test-helpers';

const SESSION = {
  accessToken: 'access-1',
  user: { ...TEST_USER, consentAt: '2026-01-01T10:00:00.000Z' },
};

function renderApp(route: RenderOptions['route']) {
  return renderAppWithProbe({ route, session: SESSION });
}

// One failed load is two requests: the first attempt and the single automatic retry.
function failingThenOk(failures: number) {
  let calls = 0;
  return () =>
    calls++ < failures
      ? errorResponse(500, 'INTERNAL_ERROR')
      : jsonResponse(TEST_PROFILE);
}

function loadedThenFailing(status: number) {
  let calls = 0;
  return () =>
    calls++ === 0
      ? jsonResponse(TEST_PROFILE)
      : errorResponse(status, 'PROFILE_ERROR');
}

async function failBackgroundRefetch(
  route: string,
  status: number,
  landedHeading: string,
) {
  const queryClient = createTestQueryClient();
  mockApi({
    'GET /api/profile': loadedThenFailing(status),
    ...EMPTY_SESSIONS_ROUTE,
  });
  renderAppWithProbe({ route, session: SESSION, queryClient });
  await heading(landedHeading);

  await act(() =>
    queryClient.refetchQueries({ queryKey: profileKeys.profile() }),
  );

  expect(queryClient.getQueryState(profileKeys.profile())?.status).toBe(
    'error',
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RequireProfile', () => {
  it('[TC-02-03] sends a user without a profile to onboarding and back to the requested page', async () => {
    stubNewUserApi();
    renderApp('/words');

    expect(await heading(text.title)).toBeInTheDocument();
    expect(currentLocation()).toBe('/onboarding');
    expect(screen.getByTestId('location-state')).toHaveTextContent(
      JSON.stringify({ from: '/words' }),
    );
    expect(screen.queryByRole('navigation')).toBeNull();

    await completeOnboarding(userEvent.setup());

    expect(await heading(uk.pages.words.title)).toBeInTheDocument();
    expect(currentLocation()).toBe('/words');
  });

  it('[TC-02-03] keeps the query string of the requested page through onboarding', async () => {
    stubNewUserApi();
    renderApp('/history?x=1');
    await heading(text.title);

    await completeOnboarding(userEvent.setup());

    expect(await heading(uk.pages.history.title)).toBeInTheDocument();
    expect(currentLocation()).toBe('/history?x=1');
  });

  it('[TC-02-03] shows a loader and no page content while the profile is loading', () => {
    mockApi({ 'GET /api/profile': () => new Promise<Response>(() => {}) });
    renderApp('/words');

    expect(
      screen.getByRole('status', { name: uk.app.gate.loading }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('[TC-02-03] shows a retry screen instead of redirecting on a server error and recovers on retry', async () => {
    const { requests } = mockApi({
      'GET /api/profile': failingThenOk(2),
    });
    renderApp('/words');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.app.gate.error,
    );
    expect(currentLocation()).toBe('/words');
    expect(screen.queryByRole('heading')).toBeNull();

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: uk.app.gate.retry }));

    expect(await heading(uk.pages.words.title)).toBeInTheDocument();
    expect(currentLocation()).toBe('/words');
    expect(requests).toHaveLength(3);
  });

  it('[TC-02-03] shows the retry screen on a 403 without redirecting or retrying', async () => {
    const { requests } = mockApi({
      'GET /api/profile': () => errorResponse(403, 'FORBIDDEN'),
    });
    renderApp('/words');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.app.gate.error,
    );
    expect(currentLocation()).toBe('/words');
    expect(requests).toHaveLength(1);
  });

  it('[TC-02-03] shows the retry screen on a network failure without leaving the page', async () => {
    mockApi({
      'GET /api/profile': () =>
        Promise.reject(new TypeError('Failed to fetch')),
    });
    renderApp('/profile');

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(currentLocation()).toBe('/profile');
  });
});

describe('RequireProfile with a loaded profile', () => {
  it.each([500, 404])(
    '[TC-02-03] stays on the page when a background refetch fails with %i',
    async (status) => {
      await failBackgroundRefetch('/words', status, uk.pages.words.title);

      expect(
        screen.getByRole('heading', { level: 1, name: uk.pages.words.title }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('alert')).toBeNull();
      expect(currentLocation()).toBe('/words');
    },
  );
});

describe('RequireNoProfile', () => {
  it.each([500, 404])(
    '[TC-02-03] keeps a user with a profile away from /onboarding when a background refetch fails with %i',
    async (status) => {
      await failBackgroundRefetch(
        '/onboarding',
        status,
        uk.pages.session.title,
      );

      expect(screen.queryByRole('alert')).toBeNull();
      expect(currentLocation()).toBe('/');
    },
  );

  it('[TC-02-03] sends a user with a profile from /onboarding to /', async () => {
    mockApi({
      'GET /api/profile': jsonResponse(TEST_PROFILE),
      ...EMPTY_SESSIONS_ROUTE,
    });
    renderApp('/onboarding');

    expect(await heading(uk.pages.session.title)).toBeInTheDocument();
    expect(currentLocation()).toBe('/');
  });

  it('[TC-02-03] ignores an unsafe origin when redirecting a user with a profile', async () => {
    mockApi({
      'GET /api/profile': jsonResponse(TEST_PROFILE),
      ...EMPTY_SESSIONS_ROUTE,
    });
    renderApp({ pathname: '/onboarding', state: { from: '//evil.example' } });

    expect(await heading(uk.pages.session.title)).toBeInTheDocument();
    expect(currentLocation()).toBe('/');
  });

  it('[TC-02-03] shows a loader on /onboarding while the profile is loading', () => {
    mockApi({ 'GET /api/profile': () => new Promise<Response>(() => {}) });
    renderApp('/onboarding');

    expect(
      screen.getByRole('status', { name: uk.app.gate.loading }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('[TC-02-03] shows the retry screen on /onboarding after a server error and redirects once the profile loads', async () => {
    mockApi({ 'GET /api/profile': failingThenOk(2), ...EMPTY_SESSIONS_ROUTE });
    renderApp('/onboarding');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.app.gate.error,
    );
    expect(screen.queryByRole('heading', { name: text.title })).toBeNull();

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: uk.app.gate.retry }));

    expect(await heading(uk.pages.session.title)).toBeInTheDocument();
    expect(currentLocation()).toBe('/');
  });
});
