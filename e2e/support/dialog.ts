import { expect, type Locator, type Page } from '@playwright/test';
import { sessionIdFromUrl } from './sessions.js';

export const FIRST_QUESTION =
  'What is your main goal when you talk about "Weekend plans"?';
export const SECOND_QUESTION =
  'Tell me about your own experience with "Weekend plans".';
export const ANSWER = 'Yesterday I go to the office. I very like my job.';
export const TENSE_FRAGMENT = 'Yesterday I go';
export const WORD_ORDER_FRAGMENT = 'I very like';

const SESSION_URL = /^\/sessions\/[0-9a-f-]{36}$/;
const REPORT_URL = /^\/sessions\/[0-9a-f-]{36}\/report$/;

export async function startDialogue(
  page: Page,
  options: { deferred: boolean },
): Promise<string> {
  await page.goto('/');
  await page.getByRole('link', { name: 'Почати сесію', exact: true }).click();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Weekend plans' }),
  ).toBeVisible();
  if (options.deferred) {
    await page.getByText('В кінці', { exact: true }).click();
  }
  await page.getByRole('button', { name: 'Почати', exact: true }).click();
  await expect(page).toHaveURL((url) => SESSION_URL.test(url.pathname));
  await expect(page.getByText(FIRST_QUESTION, { exact: true })).toBeVisible();
  return sessionIdFromUrl(page);
}

export async function openTextAnswer(page: Page): Promise<Locator> {
  const field = page.getByLabel('Ваша відповідь англійською');
  const opener = page.getByRole('button', {
    name: 'Написати відповідь',
    exact: true,
  });
  // The form stays open across turns once opened.
  await expect(field.or(opener)).toBeVisible();
  if (await opener.isVisible()) {
    await opener.click();
  }
  await expect(field).toBeEditable();
  return field;
}

export async function sendAnswer(page: Page, text: string): Promise<void> {
  const field = await openTextAnswer(page);
  await field.fill(text);
  await page.getByRole('button', { name: 'Надіслати', exact: true }).click();
}

export function fragment(page: Page, text: string): Locator {
  return page.getByRole('button', { name: text });
}

export function currentQuestion(page: Page): Locator {
  return page.getByRole('region', { name: 'Поточне питання' });
}

export async function finishFromDialogue(page: Page): Promise<void> {
  await page
    .getByRole('button', { name: 'Завершити сесію', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Завершити', exact: true })
    .click();
  await expect(page).toHaveURL((url) => REPORT_URL.test(url.pathname));
}
