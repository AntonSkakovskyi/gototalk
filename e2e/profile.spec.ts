import type { Page } from '@playwright/test';
import { authorization, expect, setProfile, test } from './support/fixtures.js';
import {
  completeOnboarding,
  expectOnboardingScreen,
} from './support/onboarding.js';

const GOAL_TITLE = 'Speak fluently in meetings';
const GOALS = [GOAL_TITLE, 'Prepare for an interview'];

test.describe('[TC-02-03] onboarding and profile', () => {
  test('[TC-02-03] a new user completes onboarding, sees the answers in the profile, changes the level and keeps it after a reload', async ({
    consentedPage: { page },
  }) => {
    await page.goto('/words');
    await expectOnboardingScreen(page);

    await completeOnboarding(page, {
      level: 'B1',
      presetScenes: ['Small talk', 'Подорожі'],
      customScene: 'Travel for work',
      goals: GOALS,
    });
    await expect(page).toHaveURL((url) => url.pathname === '/words');
    await expect(page.getByRole('heading', { name: 'Слова' })).toBeVisible();

    await page.goto('/profile');
    const details = page.getByRole('region', { name: 'Рівень і сцени' });
    await expect(details.getByText('B1', { exact: true })).toBeVisible();
    for (const scene of ['Small talk', 'Подорожі', 'Travel for work']) {
      await expect(details.getByText(scene, { exact: true })).toBeVisible();
    }
    for (const goal of GOALS) {
      await expect(page.getByText(goal, { exact: true })).toBeVisible();
    }

    await page
      .getByRole('button', { name: 'Редагувати рівень і сцени' })
      .click();
    await page.getByRole('radio', { name: 'B2' }).click();
    await page.getByRole('button', { name: 'Зберегти' }).click();
    await expect(details.getByText('B2', { exact: true })).toBeVisible();

    await page.reload();
    await expect(details.getByText('B2', { exact: true })).toBeVisible();
    await expect(details.getByText('B1', { exact: true })).toBeHidden();
    for (const scene of ['Small talk', 'Подорожі', 'Travel for work']) {
      await expect(details.getByText(scene, { exact: true })).toBeVisible();
    }
    for (const goal of GOALS) {
      await expect(page.getByText(goal, { exact: true })).toBeVisible();
    }
  });

  test('[TC-02-03] a user with a profile opening onboarding is redirected to the main screen', async ({
    signedInPage: { page },
  }) => {
    await page.goto('/onboarding');
    await expect(page).toHaveURL((url) => url.pathname === '/');
    await expect(page.getByRole('heading', { name: 'Сесія' })).toBeVisible();
  });

  test('[TC-02-03] a goal marked done stays done after a reload', async ({
    signedInPage: { page, accessToken },
  }) => {
    const created = await page.request.post('/api/goals', {
      data: { title: GOAL_TITLE },
      headers: authorization(accessToken),
    });
    expect(created.status(), 'create goal').toBe(201);

    await page.goto('/profile');
    await page
      .getByRole('button', { name: `Позначити виконаною: ${GOAL_TITLE}` })
      .click();
    const item = page.getByRole('listitem').filter({ hasText: GOAL_TITLE });
    await expect(item.getByText('Виконана', { exact: true })).toBeVisible();

    await page.reload();
    await expect(item.getByText('Виконана', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: `Відновити: ${GOAL_TITLE}` }),
    ).toBeVisible();
  });

  test('onboarding and profile have no horizontal scroll at 360 px', async ({
    consentedPage: { page, accessToken },
  }) => {
    await page.goto('/onboarding');
    await expectOnboardingScreen(page);
    await expectNoHorizontalScroll(page);

    await setProfile(page.request, accessToken, {
      level: 'B1',
      scenes: ['small_talk', 'Travel for work and long business trips abroad'],
    });

    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: 'Профіль' })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}
