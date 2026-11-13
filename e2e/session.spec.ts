import { expect, type Page } from '@playwright/test';
import { test } from './support/fixtures.js';
import { expectNoHorizontalScroll } from './support/layout.js';
import {
  listSessions,
  readSession,
  sessionIdFromUrl,
} from './support/sessions.js';

const SESSION_URL = /^\/sessions\/[0-9a-f-]{36}$/;

async function openProposal(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('link', { name: 'Почати сесію', exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === '/sessions/new');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Нова сесія' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Weekend plans' }),
  ).toBeVisible();
}

async function startSession(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Почати', exact: true }).click();
  await expect(page).toHaveURL((url) => SESSION_URL.test(url.pathname));
  return sessionIdFromUrl(page);
}

test.describe('[TC-03-03] session start', () => {
  test('[TC-03-03] a user starts a session on a custom topic after rerolling the suggestion and sees it first in the recent list', async ({
    signedInPage: { page },
  }) => {
    await openProposal(page);
    await expect(page.getByRole('listitem')).toHaveCount(5);
    await expectNoHorizontalScroll(page);

    await page.getByRole('button', { name: 'Інша тема', exact: true }).click();
    await expect(
      page.getByRole('heading', { level: 2, name: 'My hometown' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Своя тема', exact: true }).click();
    await page.getByLabel('Ваша тема').fill('My cat');
    await page
      .getByRole('button', { name: 'Застосувати', exact: true })
      .click();

    await expect(
      page.getByRole('heading', { level: 2, name: 'My cat' }),
    ).toBeVisible();
    await expect(page.getByText('Власна тема', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Інша тема', exact: true }),
    ).toBeHidden();

    await startSession(page);
    await expect(
      page.getByRole('heading', { level: 1, name: 'My cat' }),
    ).toBeVisible();
    await expect(
      page.getByText(
        'What is the first thing that comes to mind when you think about "My cat"?',
        { exact: true },
      ),
    ).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.getByRole('link', { name: 'На головну', exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/');
    const newest = page.getByRole('listitem').first();
    await expect(newest.getByText('My cat', { exact: true })).toBeVisible();
    await expect(newest.getByText('Триває', { exact: true })).toBeVisible();
    await expect(newest.getByText('Продовжити', { exact: true })).toBeVisible();
  });
});

test.describe('[TC-03-05] feedback mode', () => {
  test('[TC-03-05] choosing the end-of-session mode starts an active session with deferred feedback', async ({
    signedInPage: { page, accessToken },
  }) => {
    await openProposal(page);
    await page.getByText('В кінці', { exact: true }).click();

    const id = await startSession(page);
    await expect(
      page.getByText('Показ помилок: в кінці', { exact: true }),
    ).toBeVisible();

    const session = await readSession(page.request, accessToken, id);
    expect(session.feedbackMode).toBe('deferred');
    expect(session.status).toBe('active');
  });

  test('[TC-03-05] without switching the mode the session shows errors after each answer', async ({
    signedInPage: { page, accessToken },
  }) => {
    await openProposal(page);

    const id = await startSession(page);
    await expect(
      page.getByText('Показ помилок: після кожної відповіді', { exact: true }),
    ).toBeVisible();

    const session = await readSession(page.request, accessToken, id);
    expect(session.feedbackMode).toBe('immediate');
    expect(session.status).toBe('active');
  });
});

test.describe('[TC-03-02] single active session', () => {
  test('[TC-03-02] starting a second session finishes the first one', async ({
    signedInPage: { page, accessToken },
  }) => {
    await openProposal(page);
    const firstId = await startSession(page);

    await openProposal(page);
    const secondId = await startSession(page);

    expect(secondId).not.toBe(firstId);
    const sessions = await listSessions(page.request, accessToken);
    expect(sessions.map(({ id, status }) => ({ id, status }))).toEqual([
      { id: secondId, status: 'active' },
      { id: firstId, status: 'finished' },
    ]);
  });
});
