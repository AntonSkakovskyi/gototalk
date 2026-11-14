import { expect, test } from './support/fixtures.js';
import {
  ANSWER,
  SECOND_QUESTION,
  TENSE_FRAGMENT,
  WORD_ORDER_FRAGMENT,
  currentQuestion,
  finishFromDialogue,
  fragment,
  openTextAnswer,
  sendAnswer,
  startDialogue,
} from './support/dialog.js';
import { expectNoHorizontalScroll } from './support/layout.js';
import { readSessionDetails, readWeakAreas } from './support/sessions.js';

const BETTER_TITLE = 'Як можна сказати краще';

test.describe('[TC-04-04] text answer', () => {
  test('[TC-04-04] a text answer shows highlighted mistakes, an explanation, the not-a-mistake action and the next planned question', async ({
    signedInPage: { page, accessToken },
  }) => {
    const id = await startDialogue(page, { deferred: false });
    await expectNoHorizontalScroll(page);

    await sendAnswer(page, ANSWER);
    const tense = fragment(page, TENSE_FRAGMENT);
    const wordOrder = fragment(page, WORD_ORDER_FRAGMENT);
    await expect(tense).toBeVisible();
    await expect(wordOrder).toBeVisible();
    await expect(page.getByText(BETTER_TITLE)).toBeVisible();
    await expectNoHorizontalScroll(page);

    await tense.tap();
    const details = page.getByRole('region', { name: 'Пояснення помилки' });
    await expect(
      details.getByText(
        'Use the past simple for finished actions with a past time marker.',
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      details.getByText(
        'Для завершених дій з маркером минулого вживається Past Simple.',
        { exact: true },
      ),
    ).toBeVisible();
    await expectNoHorizontalScroll(page);

    await details
      .getByRole('button', { name: 'Це не помилка', exact: true })
      .tap();
    await expect(tense).toBeHidden();
    await expect(wordOrder).toBeVisible();

    await expect(
      currentQuestion(page).getByText(SECOND_QUESTION, { exact: true }),
    ).toBeVisible();
    await openTextAnswer(page);
    await expectNoHorizontalScroll(page);

    const session = await readSessionDetails(page.request, accessToken, id);
    const answer = session.utterances.find(({ role }) => role === 'user');
    expect(answer?.analysisStatus).toBe('done');
    expect(answer?.mistakes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'verb_tense', isFalse: true }),
        expect.objectContaining({ category: 'word_order', isFalse: false }),
      ]),
    );

    const weakAreas = await readWeakAreas(page.request, accessToken);
    expect(weakAreas).toContainEqual({ category: 'word_order', frequency: 1 });
    expect(
      weakAreas.filter(({ category }) => category === 'verb_tense'),
    ).toEqual([]);
  });
});

test.describe('[TC-04-11] deferred feedback', () => {
  test('[TC-04-11] in the end-of-session mode the dialogue shows no highlights and the report does', async ({
    signedInPage: { page },
  }) => {
    await startDialogue(page, { deferred: true });
    await sendAnswer(page, ANSWER);

    await expect(
      currentQuestion(page).getByText(SECOND_QUESTION, { exact: true }),
    ).toBeVisible();
    await expect(fragment(page, TENSE_FRAGMENT)).toHaveCount(0);
    await expect(fragment(page, WORD_ORDER_FRAGMENT)).toHaveCount(0);
    await expect(page.getByText(BETTER_TITLE)).toHaveCount(0);
    await expect(page.getByText(ANSWER, { exact: true })).toBeVisible();
    await expectNoHorizontalScroll(page);

    await finishFromDialogue(page);
    await expect(fragment(page, TENSE_FRAGMENT)).toBeVisible();
    await expect(fragment(page, WORD_ORDER_FRAGMENT)).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});

test.describe('[TC-04-04] finishing the session', () => {
  test('[TC-04-04] a finished session is read-only with a link to the report', async ({
    signedInPage: { page, accessToken },
  }) => {
    const id = await startDialogue(page, { deferred: false });
    await sendAnswer(page, ANSWER);
    await expect(fragment(page, WORD_ORDER_FRAGMENT)).toBeVisible();

    await finishFromDialogue(page);
    await expect(page).toHaveURL(
      (url) => url.pathname === `/sessions/${id}/report`,
    );
    const session = await readSessionDetails(page.request, accessToken, id);
    expect(session.status).toBe('finished');

    await page.goto(`/sessions/${id}`);
    await expect(
      page.getByRole('link', { name: 'До звіту', exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel('Ваша відповідь англійською')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Завершити сесію', exact: true }),
    ).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });
});
