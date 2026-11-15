import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import uk from '@/shared/i18n/uk.json';
import type { RenderOptions } from '@/shared/testing/test-utils';
import { mockApi } from '@/shared/testing/mock-api';
import {
  EMPTY_SESSIONS_ROUTE,
  jsonResponse,
} from '@/shared/testing/http-responses';
import { TEST_PROFILE } from '@/shared/testing/fixtures/profile';
import { TEST_USER, authResponse } from '@/shared/testing/fixtures/auth';
import {
  currentLocation,
  heading,
  renderAppWithProbe,
} from './guard-test-helpers';

const CONSENT_DATE = '2026-01-01T10:00:00.000Z';
const CONSENTED_USER = { ...TEST_USER, consentAt: CONSENT_DATE };

function renderApp(
  route: RenderOptions['route'],
  session: RenderOptions['session'] = 'anonymous',
) {
  return renderAppWithProbe({ route, session });
}

async function logIn() {
  const user = userEvent.setup();
  await user.type(
    await screen.findByLabelText(uk.auth.fields.email),
    'anna@example.com',
  );
  await user.type(
    screen.getByLabelText(uk.auth.fields.password),
    'secret-pass',
  );
  await user.click(screen.getByRole('button', { name: uk.auth.login.submit }));
}

function stubApi(loggedIn: typeof TEST_USER) {
  mockApi({
    'GET /api/profile': jsonResponse(TEST_PROFILE),
    ...EMPTY_SESSIONS_ROUTE,
    'POST /api/auth/login': jsonResponse(authResponse('token-1', loggedIn)),
    'GET /api/me/consent': jsonResponse({
      consentAt: null,
      providers: { stt: 'fake', llm: 'fake' },
    }),
    'POST /api/me/consent': jsonResponse(CONSENTED_USER),
  });
}

describe('redirect after login', () => {
  it('[TC-02-03] sends an anonymous user to /login and returns to the requested page after login', async () => {
    stubApi(CONSENTED_USER);
    renderApp('/history?x=1');

    expect(await heading(uk.auth.login.title)).toBeInTheDocument();
    expect(currentLocation()).toBe('/login');
    expect(screen.getByTestId('location-state')).toHaveTextContent(
      JSON.stringify({ from: '/history?x=1' }),
    );

    await logIn();

    expect(await heading(uk.pages.history.title)).toBeInTheDocument();
    expect(currentLocation()).toBe('/history?x=1');
  });

  it.each(['//evil.example', '/onboarding', 'https://evil.example'])(
    '[TC-02-03] falls back to / after login for the unsafe origin %s',
    async (from) => {
      stubApi(CONSENTED_USER);
      renderApp({ pathname: '/login', state: { from } });

      await logIn();

      expect(await heading(uk.pages.session.title)).toBeInTheDocument();
      expect(currentLocation()).toBe('/');
    },
  );

  it('[TC-02-03] keeps the requested page through login and the consent screen', async () => {
    stubApi(TEST_USER);
    renderApp('/words');
    await logIn();

    expect(await heading(uk.pages.consent.title)).toBeInTheDocument();
    expect(currentLocation()).toBe('/consent');

    await userEvent
      .setup()
      .click(
        await screen.findByRole('button', { name: uk.pages.consent.agree }),
      );

    expect(await heading(uk.pages.words.title)).toBeInTheDocument();
    expect(currentLocation()).toBe('/words');
  });

  it('[TC-02-03] returns to the requested page after consent for a user who was already signed in', async () => {
    stubApi(TEST_USER);
    renderApp('/history?x=1', authResponse());

    expect(await heading(uk.pages.consent.title)).toBeInTheDocument();
    await userEvent
      .setup()
      .click(
        await screen.findByRole('button', { name: uk.pages.consent.agree }),
      );

    expect(await heading(uk.pages.history.title)).toBeInTheDocument();
    expect(currentLocation()).toBe('/history?x=1');
  });
});
