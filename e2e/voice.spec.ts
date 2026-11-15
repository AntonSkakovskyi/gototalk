import { expect, test } from './support/fixtures.js';
import {
  SECOND_QUESTION,
  WORD_ORDER_FRAGMENT,
  currentQuestion,
  finishFromDialogue,
  fragment,
  openDeepAnalysis,
  startDialogue,
} from './support/dialog.js';
import { expectNoHorizontalScroll } from './support/layout.js';
import { readSessionDetails } from './support/sessions.js';
import type { Page } from '@playwright/test';

const FIRST_TRANSCRIPT =
  'Um, yesterday I go to the office and, uh, I have a meeting with my team. I very like my job.';

async function recordAnswer(page: Page): Promise<void> {
  await page
    .getByRole('button', { name: 'Записати відповідь', exact: true })
    .click();
  await expect(page.getByText('Іде запис', { exact: true })).toBeVisible();
  await expect(page.getByRole('timer')).toHaveText(/0:0[1-9] \/ 2:00/);
  await page
    .getByRole('button', {
      name: 'Записати відповідь',
      exact: true,
      pressed: true,
    })
    .click();
}

test.describe('[TC-04-05] voice answer', () => {
  test('[TC-04-05] a recorded answer is transcribed, analysed and followed by the next question, a hint and the report', async ({
    signedInPage: { page, accessToken },
  }) => {
    const id = await startDialogue(page, { deferred: false });
    await expectNoHorizontalScroll(page);

    await recordAnswer(page);

    const mistake = fragment(page, WORD_ORDER_FRAGMENT);
    await expect(mistake).toBeVisible();
    await expect(
      currentQuestion(page).getByText(SECOND_QUESTION, { exact: true }),
    ).toBeVisible();
    await expectNoHorizontalScroll(page);

    await mistake.tap();
    const details = page.getByRole('region', { name: 'Пояснення помилки' });
    await expect(
      details.getByText(
        '"Very" does not go before a verb; use "really" or "very much" after the object.',
        { exact: true },
      ),
    ).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.getByRole('button', { name: 'Підказка', exact: true }).click();
    await page
      .getByRole('button', { name: 'Як сказати слово', exact: true })
      .click();
    await page.getByLabel('Слово українською').fill('зустріч');
    await page.getByRole('button', { name: 'Перекласти', exact: true }).click();
    await expect(
      page.getByText('зустріч = meeting', { exact: true }),
    ).toBeVisible();
    await expectNoHorizontalScroll(page);

    const session = await readSessionDetails(page.request, accessToken, id);
    const answer = session.utterances.find(({ role }) => role === 'user');
    expect(answer?.text).toBe(FIRST_TRANSCRIPT);
    expect(answer?.analysisStatus).toBe('done');

    await finishFromDialogue(page);
    await openDeepAnalysis(page);
    await expect(fragment(page, WORD_ORDER_FRAGMENT)).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});

test.describe('[TC-04-12] processing statuses', () => {
  test('[TC-04-12] the recognising and analysing statuses follow the upload and the analysis requests', async ({
    signedInPage: { page },
  }) => {
    await startDialogue(page, { deferred: false });

    let releaseUpload: () => void = () => undefined;
    let releaseAnalysis: () => void = () => undefined;
    const uploadGate = new Promise<void>((resolve) => {
      releaseUpload = resolve;
    });
    const analysisGate = new Promise<void>((resolve) => {
      releaseAnalysis = resolve;
    });
    await page.route('**/api/sessions/*/utterances', async (route) => {
      await uploadGate;
      await route.continue();
    });
    await page.route(
      '**/api/sessions/*/utterances/*/analysis',
      async (route) => {
        await analysisGate;
        await route.continue();
      },
    );

    try {
      await recordAnswer(page);
      await expect(page.getByText('Розпізнаю…', { exact: true })).toBeVisible();
      await expect(page.getByText('Аналізую…')).toHaveCount(0);

      releaseUpload();
      await expect(page.getByText('Аналізую…', { exact: true })).toBeVisible();
      await expect(page.getByText('Розпізнаю…')).toHaveCount(0);

      releaseAnalysis();
      await expect(fragment(page, WORD_ORDER_FRAGMENT)).toBeVisible();
      await expect(page.getByText('Аналізую…')).toHaveCount(0);
    } finally {
      releaseUpload();
      releaseAnalysis();
    }
  });
});
