import { expect, test } from '@playwright/test';

const TABS = [
  { label: 'Слова', path: '/words' },
  { label: 'Історія', path: '/history' },
  { label: 'Профіль', path: '/profile' },
  { label: 'Сесія', path: '/' },
] as const;

test.describe('[TC-00-02] smoke: мобільний layout і health', () => {
  test('[TC-00-02] нижня навігація українською, клік змінює URL', async ({
    page,
  }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Основна навігація' });
    await expect(nav).toBeVisible();

    for (const { label } of TABS) {
      await expect(
        nav.getByRole('link', { name: label, exact: true }),
      ).toBeVisible();
    }

    for (const { label, path } of TABS) {
      await nav.getByRole('link', { name: label, exact: true }).click();
      await expect(page).toHaveURL((url) => url.pathname === path);
    }
  });

  test('[TC-00-02] без горизонтального скролу, навігація внизу екрана', async ({
    page,
  }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Основна навігація' });
    await expect(nav).toBeVisible();

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

    const box = await nav.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    // Нижня межа навігації збігається з низом в'юпорту (допуск на дробові значення).
    expect(
      Math.abs(box!.y + box!.height - viewport!.height),
    ).toBeLessThanOrEqual(1);
  });

  test('[TC-00-02] /api/health через проксі Vite повертає ok', async ({
    page,
  }) => {
    const response = await page.request.get('/api/health');
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'ok', db: 'ok' });
  });
});
