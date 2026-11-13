import { screen } from '@testing-library/react';
import { App } from '@/app/App';
import uk from '@/shared/i18n/uk.json';
import { TEST_USER } from '@/shared/testing/test-fixtures';
import { renderWithProviders } from '@/shared/testing/test-utils';

const WITH_CONSENT = {
  accessToken: 'access-1',
  user: { ...TEST_USER, consentAt: '2026-01-01T10:00:00.000Z' },
};
const WITHOUT_CONSENT = { accessToken: 'access-1', user: TEST_USER };

function heading(name: string) {
  return screen.getByRole('heading', { level: 1, name });
}

describe('route guards', () => {
  it('[TC-01-03] redirects an anonymous user from a protected route to /login', () => {
    renderWithProviders(<App />, { route: '/words', session: 'anonymous' });

    expect(heading(uk.auth.login.title)).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('[TC-01-03] redirects an anonymous user from an unknown path to /login', () => {
    renderWithProviders(<App />, { route: '/nope', session: 'anonymous' });

    expect(heading(uk.auth.login.title)).toBeInTheDocument();
  });

  it('[TC-01-03] redirects an anonymous user from /consent to /login', () => {
    renderWithProviders(<App />, { route: '/consent', session: 'anonymous' });

    expect(heading(uk.auth.login.title)).toBeInTheDocument();
  });

  it('[TC-01-03] renders nothing while the session is still unknown', () => {
    renderWithProviders(<App />, { route: '/words' });

    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('[TC-01-03] redirects an authenticated user without consent from a protected route to /consent', () => {
    renderWithProviders(<App />, { route: '/words', session: WITHOUT_CONSENT });

    expect(heading(uk.pages.consent.title)).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('[TC-01-03] redirects an authenticated user without consent from an unknown path to /consent', () => {
    renderWithProviders(<App />, { route: '/nope', session: WITHOUT_CONSENT });

    expect(heading(uk.pages.consent.title)).toBeInTheDocument();
  });

  it('[TC-01-03] lets a user with consent open protected routes', () => {
    renderWithProviders(<App />, { route: '/words', session: WITH_CONSENT });

    expect(heading(uk.pages.words.title)).toBeInTheDocument();
  });

  it('[TC-01-03] redirects a user with consent from /consent to /', () => {
    renderWithProviders(<App />, { route: '/consent', session: WITH_CONSENT });

    expect(heading(uk.pages.session.title)).toBeInTheDocument();
  });

  it('[TC-01-03] redirects an authenticated user with consent from /login and /register to /', () => {
    const { unmount } = renderWithProviders(<App />, {
      route: '/login',
      session: WITH_CONSENT,
    });
    expect(heading(uk.pages.session.title)).toBeInTheDocument();
    unmount();

    renderWithProviders(<App />, { route: '/register', session: WITH_CONSENT });
    expect(heading(uk.pages.session.title)).toBeInTheDocument();
  });

  it('[TC-01-03] redirects an authenticated user without consent from /login to /consent', () => {
    renderWithProviders(<App />, { route: '/login', session: WITHOUT_CONSENT });

    expect(heading(uk.pages.consent.title)).toBeInTheDocument();
  });
});
