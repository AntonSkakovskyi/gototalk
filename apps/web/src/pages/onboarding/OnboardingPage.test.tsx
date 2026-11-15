import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@/app/App';
import {
  completeOnboarding,
  stubNewUserApi,
  text,
} from '@/features/profile/testing/wizard-test-helpers';
import { uk } from '@/shared/i18n/resources';
import { TEST_USER } from '@/shared/testing/fixtures/auth';
import { renderWithProviders } from '@/shared/testing/test-utils';

const SESSION = {
  accessToken: 'access-1',
  user: { ...TEST_USER, consentAt: '2026-01-01T10:00:00.000Z' },
};

describe('OnboardingPage', () => {
  it('[TC-02-03] renders the wizard without the bottom navigation', async () => {
    stubNewUserApi();
    renderWithProviders(<App />, { route: '/onboarding', session: SESSION });

    expect(
      await screen.findByRole('heading', { level: 1, name: text.title }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('[TC-02-03] returns to the page the user came from after completion', async () => {
    stubNewUserApi();
    renderWithProviders(<App />, {
      route: { pathname: '/onboarding', state: { from: '/words' } },
      session: SESSION,
    });
    await screen.findByRole('heading', { level: 1, name: text.title });

    await completeOnboarding(userEvent.setup());

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: uk.pages.words.title,
      }),
    ).toBeInTheDocument();
  });

  it('[TC-02-03] falls back to the home page for an invalid origin', async () => {
    stubNewUserApi();
    renderWithProviders(<App />, {
      route: {
        pathname: '/onboarding',
        state: { from: 'https://evil.example' },
      },
      session: SESSION,
    });
    await screen.findByRole('heading', { level: 1, name: text.title });

    await completeOnboarding(userEvent.setup());

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: uk.pages.session.title,
      }),
    ).toBeInTheDocument();
  });
});
