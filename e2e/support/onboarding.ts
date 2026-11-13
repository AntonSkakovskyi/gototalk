import { expect, type Page } from '@playwright/test';

export interface OnboardingAnswers {
  level: string;
  presetScenes: string[];
  customScene?: string;
  goals: string[];
}

export const DEFAULT_ANSWERS: OnboardingAnswers = {
  level: 'B1',
  presetScenes: ['Small talk'],
  goals: ['Speak fluently in meetings'],
};

export async function expectOnboardingScreen(page: Page): Promise<void> {
  await expect(page).toHaveURL((url) => url.pathname === '/onboarding');
  await expect(
    page.getByRole('heading', { name: 'Налаштування профілю' }),
  ).toBeVisible();
}

export async function completeOnboarding(
  page: Page,
  { level, presetScenes, customScene, goals }: OnboardingAnswers,
): Promise<void> {
  const next = page.getByRole('button', { name: 'Далі', exact: true });

  await page.getByRole('radio', { name: level }).click();
  await next.click();

  for (const scene of presetScenes) {
    await page.getByText(scene, { exact: true }).click();
    await expect(
      page.getByRole('checkbox', { name: scene, exact: true }),
    ).toBeChecked();
  }
  if (customScene) {
    await page.getByLabel('Своя сцена').fill(customScene);
    await page.getByRole('button', { name: 'Додати', exact: true }).click();
    await expect(
      page.getByRole('checkbox', { name: customScene, exact: true }),
    ).toBeChecked();
  }
  await next.click();

  for (const [index, goal] of goals.entries()) {
    if (index > 0) {
      await page.getByRole('button', { name: 'Додати ціль' }).click();
    }
    await page.getByLabel(`Ціль ${index + 1}`, { exact: true }).fill(goal);
  }
  await page.getByRole('button', { name: 'Завершити' }).click();
}
