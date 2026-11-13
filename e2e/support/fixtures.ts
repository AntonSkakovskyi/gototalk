import { randomUUID } from 'node:crypto';
import {
  test as base,
  expect,
  type APIRequestContext,
  type Page,
} from '@playwright/test';

export interface Credentials {
  email: string;
  password: string;
}

interface AuthResponse {
  accessToken: string;
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
  const { accessToken } = (await login.json()) as AuthResponse;
  const removal = await request.delete('/api/me', {
    data: { password },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect(removal.status(), 'cleanup delete').toBe(204);
}

interface Fixtures {
  /** Fresh unregistered credentials; the account is deleted after the test if it exists. */
  account: Credentials;
  /** A page whose browser context already holds a session of a registered user with given consent. */
  signedInPage: { page: Page; account: Credentials };
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

  signedInPage: async ({ page, account }, use) => {
    const registration = await page.request.post('/api/auth/register', {
      data: account,
    });
    expect(registration.status(), 'register').toBe(201);
    const { accessToken } = (await registration.json()) as AuthResponse;
    const consent = await page.request.post('/api/me/consent', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(consent.status(), 'consent').toBe(200);
    await use({ page, account });
  },
});

export { expect };
