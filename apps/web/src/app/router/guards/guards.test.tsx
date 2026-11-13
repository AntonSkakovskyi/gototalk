import { screen } from '@testing-library/react';
import { App } from '@/app/App';
import uk from '@/shared/i18n/uk.json';
import { mockApi } from '@/shared/testing/mock-api';
import {
  TEST_PROFILE,
  TEST_USER,
  jsonResponse,
} from '@/shared/testing/test-fixtures';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { heading } from './guard-test-helpers';

const WITH_CONSENT = {
  accessToken: 'access-1',
  user: { ...TEST_USER, consentAt: '2026-01-01T10:00:00.000Z' },
};
const WITHOUT_CONSENT = { accessToken: 'access-1', user: TEST_USER };

beforeEach(() => {
  mockApi({ 'GET /api/profile': jsonResponse(TEST_PROFILE) });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('route guards', () => {
  it('[TC-01-03] redirects an anonymous user from a protected route to /login', async () => {
    renderWithProviders(<App />, { route: '/words', session: 'anonymous' });

    expect(await heading(uk.auth.login.title)).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('[TC-01-03] redirects an anonymous user from an unknown path to /login', async () => {
    renderWithProviders(<App />, { route: '/nope', session: 'anonymous' });

    expect(await heading(uk.auth.login.title)).toBeInTheDocument();
  });

  it('[TC-01-03] redirects an anonymous user from /consent to /login', async () => {
    renderWithProviders(<App />, { route: '/consent', session: 'anonymous' });

    expect(await heading(uk.auth.login.title)).toBeInTheDocument();
  });

  it('[TC-01-03] renders nothing while the session is still unknown', () => {
    renderWithProviders(<App />, { route: '/words' });

    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('[TC-01-03] redirects an authenticated user without consent from a protected route to /consent', async () => {
    renderWithProviders(<App />, { route: '/words', session: WITHOUT_CONSENT });

    expect(await heading(uk.pages.consent.title)).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('[TC-01-03] redirects an authenticated user without consent from an unknown path to /consent', async () => {
    renderWithProviders(<App />, { route: '/nope', session: WITHOUT_CONSENT });

    expect(await heading(uk.pages.consent.title)).toBeInTheDocument();
  });

  it('[TC-01-03] lets a user with consent open protected routes', async () => {
    renderWithProviders(<App />, { route: '/words', session: WITH_CONSENT });

    expect(await heading(uk.pages.words.title)).toBeInTheDocument();
  });

  it('[TC-01-03] redirects a user with consent from /consent to /', async () => {
    renderWithProviders(<App />, { route: '/consent', session: WITH_CONSENT });

    expect(await heading(uk.pages.session.title)).toBeInTheDocument();
  });

  it('[TC-01-03] redirects an authenticated user with consent from /login and /register to /', async () => {
    const { unmount } = renderWithProviders(<App />, {
      route: '/login',
      session: WITH_CONSENT,
    });
    expect(await heading(uk.pages.session.title)).toBeInTheDocument();
    unmount();

    renderWithProviders(<App />, { route: '/register', session: WITH_CONSENT });
    expect(await heading(uk.pages.session.title)).toBeInTheDocument();
  });

  it('[TC-01-03] redirects an authenticated user without consent from /login to /consent', async () => {
    renderWithProviders(<App />, { route: '/login', session: WITHOUT_CONSENT });

    expect(await heading(uk.pages.consent.title)).toBeInTheDocument();
  });
});
