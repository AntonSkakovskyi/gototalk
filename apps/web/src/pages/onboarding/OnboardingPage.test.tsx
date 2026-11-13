import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@/app/App';
import {
  button,
  chip,
  chooseLevel,
  goalField,
  presets,
  text,
} from '@/features/profile/components/OnboardingWizard/wizard-test-helpers';
import uk from '@/shared/i18n/uk.json';
import { mockApi } from '@/shared/testing/mock-api';
import {
  TEST_PROFILE,
  TEST_USER,
  jsonResponse,
  testGoal,
} from '@/shared/testing/test-fixtures';
import { renderWithProviders } from '@/shared/testing/test-utils';

const SESSION = {
  accessToken: 'access-1',
  user: { ...TEST_USER, consentAt: '2026-01-01T10:00:00.000Z' },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

async function completeOnboarding() {
  const user = userEvent.setup();
  await chooseLevel(user, 'B1');
  await user.click(button(text.actions.next));
  await user.click(chip(presets.travel));
  await user.click(button(text.actions.next));
  await user.type(goalField(1), 'Speak fluently');
  await user.click(button(text.actions.finish));
}

function stubApi() {
  mockApi({
    'GET /api/goals': jsonResponse([]),
    'POST /api/goals': jsonResponse(testGoal(), 201),
    'PUT /api/profile': jsonResponse(TEST_PROFILE),
  });
}

describe('OnboardingPage', () => {
  it('[TC-02-03] renders the wizard without the bottom navigation', () => {
    renderWithProviders(<App />, { route: '/onboarding', session: SESSION });

    expect(
      screen.getByRole('heading', { level: 1, name: text.title }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('[TC-02-03] returns to the page the user came from after completion', async () => {
    stubApi();
    renderWithProviders(<App />, {
      route: { pathname: '/onboarding', state: { from: '/words' } },
      session: SESSION,
    });

    await completeOnboarding();

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: uk.pages.words.title,
      }),
    ).toBeInTheDocument();
  });

  it('[TC-02-03] falls back to the home page for an invalid origin', async () => {
    stubApi();
    renderWithProviders(<App />, {
      route: {
        pathname: '/onboarding',
        state: { from: 'https://evil.example' },
      },
      session: SESSION,
    });

    await completeOnboarding();

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: uk.pages.session.title,
      }),
    ).toBeInTheDocument();
  });
});
