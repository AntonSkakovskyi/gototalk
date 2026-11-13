import { randomUUID } from 'node:crypto';
import {
  test as base,
  expect,
  type APIRequestContext,
  type APIResponse,
  type Page,
} from '@playwright/test';

export interface Credentials {
  email: string;
  password: string;
}

export function authorization(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}

async function readAccessToken(response: APIResponse): Promise<string> {
  const body: unknown = await response.json();
  if (
    typeof body === 'object' &&
    body !== null &&
    'accessToken' in body &&
    typeof body.accessToken === 'string'
  ) {
    return body.accessToken;
  }
  throw new Error('auth response has no accessToken');
}

export async function setProfile(
  request: APIRequestContext,
  accessToken: string,
  body: { level: string; scenes: string[] },
): Promise<void> {
  const response = await request.put('/api/profile', {
    data: body,
    headers: authorization(accessToken),
  });
  expect(response.status(), 'profile').toBe(200);
}

export function createCredentials(): Credentials {
  return {
    email: `e2e-${randomUUID()}@example.test`,
    password: `pw-${randomUUID()}`,
  };
}

/** Removes the account through the API; a missing account (already deleted by the test) is not an error. */
async function deleteAccount(
  request: APIRequestContext,
  { email, password }: Credentials,
): Promise<void> {
  const login = await request.post('/api/auth/login', {
    data: { email, password },
  });
  if (login.status() === 401) {
    return;
  }
  expect(login.status(), `cleanup login returned ${login.status()}`).toBe(200);
  const accessToken = await readAccessToken(login);
  const removal = await request.delete('/api/me', {
    data: { password },
    headers: authorization(accessToken),
  });
  expect(removal.status(), 'cleanup delete').toBe(204);
}

interface SignedIn {
  page: Page;
  account: Credentials;
  accessToken: string;
}

interface Fixtures {
  /** Fresh unregistered credentials; the account is deleted after the test if it exists. */
  account: Credentials;
  /** A registered user with given consent and no profile yet, so the app sends them to onboarding. */
  consentedPage: SignedIn;
  /** A registered user with given consent and a profile, who reaches the main screens directly. */
  signedInPage: SignedIn;
}

export const test = base.extend<Fixtures>({
  account: async ({ playwright, baseURL, context }, use) => {
    const credentials = createCredentials();
    // A dedicated context keeps cleanup cookies out of the browser under test.
    const cleanup = await playwright.request.newContext({ baseURL });
    try {
      await use(credentials);
    } finally {
      // Close the browser first so its pending requests are aborted before cleanup starts.
      await context.close();
      try {
        await deleteAccount(cleanup, credentials);
      } finally {
        await cleanup.dispose();
      }
    }
  },

  consentedPage: async ({ page, account }, use) => {
    const registration = await page.request.post('/api/auth/register', {
      data: account,
    });
    expect(registration.status(), 'register').toBe(201);
    const accessToken = await readAccessToken(registration);
    const consent = await page.request.post('/api/me/consent', {
      headers: authorization(accessToken),
    });
    expect(consent.status(), 'consent').toBe(200);
    await use({ page, account, accessToken });
  },

  signedInPage: async ({ consentedPage }, use) => {
    const { page, accessToken } = consentedPage;
    await setProfile(page.request, accessToken, {
      level: 'B1',
      scenes: ['small_talk'],
    });
    await use(consentedPage);
  },
});

export { expect };
