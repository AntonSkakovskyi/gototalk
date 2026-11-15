import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures.js';
import {
  ANSWER,
  TENSE_FRAGMENT,
  finishFromDialogue,
  fragment,
  openDeepAnalysis,
  sendAnswer,
  startDialogue,
} from './support/dialog.js';
import { expectNoHorizontalScroll } from './support/layout.js';
import {
  markOption,
  markWord,
  readReport,
  readWordStates,
  sessionWords,
} from './support/report.js';

async function translateHint(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Підказка', exact: true }).click();
  await page
    .getByRole('button', { name: 'Як сказати слово', exact: true })
    .click();
  await page.getByLabel('Слово українською').fill('зустріч');
  await page.getByRole('button', { name: 'Перекласти', exact: true }).click();
  await expect(
    page.getByText('зустріч = meeting', { exact: true }),
  ).toBeVisible();
}

const LEMMAS = ['meeting', 'went', 'really'];

test.describe('[TC-05-03] session report', () => {
  test('[TC-05-03] a finished session shows the summary, the deep analysis with theory and word marks that survive a return from the history and reach the word list', async ({
    signedInPage: { page, accessToken },
  }) => {
    const id = await startDialogue(page, { deferred: false });
    await translateHint(page);

    await sendAnswer(page, ANSWER);
    await expect(fragment(page, TENSE_FRAGMENT)).toBeVisible();

    await finishFromDialogue(page);
    await expect(
      page.getByRole('heading', { level: 2, name: 'Підсумок сесії' }),
    ).toBeVisible();
    await expect(page.getByText(/^Ви відповіли 1 раз/)).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 3, name: 'Найчастіші помилки' }),
    ).toBeVisible();
    await expect(
      page
        .getByRole('list', { name: 'Найчастіші помилки' })
        .getByRole('listitem'),
    ).toHaveText(['Часи дієслів – 1', 'Порядок слів – 1']);
    await expectNoHorizontalScroll(page);

    // Relies on the seeded Past simple theory link and on the Fake model's lemmas (meeting, went, really).
    await openDeepAnalysis(page);
    const tenseGroup = page.getByRole('region', { name: 'Часи дієслів – 1' });
    const theory = tenseGroup.getByRole('link', { name: /Past simple/ });
    await expect(theory).toBeVisible();
    expect(await theory.getAttribute('href')).toMatch(/^https:\/\//);
    await expectNoHorizontalScroll(page);

    const words = sessionWords(page);
    for (const lemma of LEMMAS) {
      await expect(words.getByText(lemma, { exact: true })).toBeVisible();
    }

    await markWord(words, 'meeting', 'Знав');
    await markWord(words, 'went', 'Частково');
    await markWord(words, 'really', 'Частково');
    await markWord(words, 'really', 'Не знав');
    await expectNoHorizontalScroll(page);

    await page.getByRole('link', { name: 'Історія', exact: true }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Історія' }),
    ).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.getByRole('link', { name: /Weekend plans/ }).click();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Підсумок сесії' }),
    ).toBeVisible();

    await expect(
      markOption(sessionWords(page), 'meeting', 'Знав'),
    ).toBeChecked();
    await expect(
      markOption(sessionWords(page), 'went', 'Частково'),
    ).toBeChecked();
    await expect(
      markOption(sessionWords(page), 'really', 'Не знав'),
    ).toBeChecked();
    await expectNoHorizontalScroll(page);

    expect(await readWordStates(page.request, accessToken)).toMatchObject({
      meeting: 'passive',
      went: 'partial',
      really: 'new',
    });
    const report = await readReport(page.request, accessToken, id);
    expect(report.words.map(({ lemma }) => lemma).sort()).toEqual(
      [...LEMMAS].sort(),
    );

    await page.getByRole('link', { name: 'Слова', exact: true }).click();
    const labels = {
      meeting: 'Пасивне',
      went: 'Частково знаю',
      really: 'Нове',
    };
    for (const [lemma, label] of Object.entries(labels)) {
      await expect(
        page.getByRole('listitem').filter({ hasText: lemma }),
      ).toContainText(label);
    }
    await expectNoHorizontalScroll(page);
  });
});

test.describe('[TC-05-05] word marks', () => {
  test('[TC-05-05] a mark set in the word list is kept after a reload', async ({
    signedInPage: { page, accessToken },
  }) => {
    await startDialogue(page, { deferred: false });
    await translateHint(page);

    await page.getByRole('link', { name: 'Слова', exact: true }).click();
    const item = page.getByRole('listitem').filter({ hasText: 'meeting' });
    await expect(item).toContainText('Нове');
    await markWord(item, 'meeting', 'Частково');
    await expect(item).toContainText('Частково знаю');

    await page.reload();
    await expect(
      markOption(
        page.getByRole('listitem').filter({ hasText: 'meeting' }),
        'meeting',
        'Частково',
      ),
    ).toBeChecked();
    expect(await readWordStates(page.request, accessToken)).toMatchObject({
      meeting: 'partial',
    });
    await expectNoHorizontalScroll(page);
  });
});
