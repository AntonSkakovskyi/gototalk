import { expect, test } from './support/fixtures.js';

test.describe('[TC-01-03] auth: registration, consent, logout and login', () => {
  test('[TC-01-03] registration → consent → main screen, reload keeps the session', async ({
    page,
    account,
  }) => {
    await page.goto('/register');
    await page.getByLabel('Email', { exact: true }).fill(account.email);
    await page.getByLabel('Пароль', { exact: true }).fill(account.password);
    await page.getByRole('button', { name: 'Зареєструватися' }).click();

    await expect(page).toHaveURL((url) => url.pathname === '/consent');
    await expect(page.getByRole('heading', { name: 'Згода' })).toBeVisible();
    await page.getByRole('button', { name: 'Погоджуюсь' }).click();

    await expect(page).toHaveURL((url) => url.pathname === '/');
    await expect(page.getByRole('heading', { name: 'Сесія' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Сесія' })).toBeVisible();
    await expect(page).toHaveURL((url) => url.pathname === '/');
  });

  test('[TC-01-03] logout → login page → login again → main screen', async ({
    signedInPage: { page, account },
  }) => {
    await page.goto('/profile');
    await page.getByRole('button', { name: 'Вийти' }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/login');
    await expect(page.getByRole('heading', { name: 'Вхід' })).toBeVisible();

    await page.getByLabel('Email', { exact: true }).fill(account.email);
    await page.getByLabel('Пароль', { exact: true }).fill(account.password);
    await page.getByRole('button', { name: 'Увійти' }).click();

    await expect(page).toHaveURL((url) => url.pathname === '/');
    await expect(page.getByRole('heading', { name: 'Сесія' })).toBeVisible();
  });

  test('[TC-01-03] two tabs reloading concurrently both stay signed in', async ({
    signedInPage: { page },
  }) => {
    const second = await page.context().newPage();
    await Promise.all([page.goto('/'), second.goto('/')]);
    for (const tab of [page, second]) {
      await expect(tab.getByRole('heading', { name: 'Сесія' })).toBeVisible();
      await expect(tab).toHaveURL((url) => url.pathname === '/');
    }

    for (let round = 0; round < 3; round += 1) {
      await Promise.all([page.reload(), second.reload()]);
      for (const tab of [page, second]) {
        await expect(tab.getByRole('heading', { name: 'Сесія' })).toBeVisible();
        await expect(tab).toHaveURL((url) => url.pathname === '/');
      }
    }
  });

  test('[TC-01-03] delete account: wrong password is rejected, correct one leads to login, credentials stop working', async ({
    signedInPage: { page, account },
  }) => {
    await page.goto('/profile');
    await page.getByRole('button', { name: 'Видалити акаунт' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByLabel('Пароль', { exact: true }).fill('wrong-password-1');
    await dialog.getByRole('button', { name: 'Видалити назавжди' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('Неправильний пароль');
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL((url) => url.pathname === '/profile');

    await dialog.getByLabel('Пароль', { exact: true }).fill(account.password);
    await dialog.getByRole('button', { name: 'Видалити назавжди' }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/login');

    await page.getByLabel('Email', { exact: true }).fill(account.email);
    await page.getByLabel('Пароль', { exact: true }).fill(account.password);
    await page.getByRole('button', { name: 'Увійти' }).click();
    await expect(page.getByRole('alert')).toHaveText(
      'Неправильний email або пароль',
    );
    await expect(page).toHaveURL((url) => url.pathname === '/login');
  });
});
