import { defineConfig } from '@playwright/test';

// Локально e2e працює в встановленому Microsoft Edge (завантаження браузерів не потрібне).
// У CI за замовчуванням використовується Chromium від Playwright (`pnpm exec playwright install --with-deps chromium`);
// канал можна задати змінною PW_CHANNEL (наприклад chrome).
const channel = process.env.PW_CHANNEL ?? (process.env.CI ? '' : 'msedge');

// e2e потребує піднятої БД (`podman compose up -d` + `pnpm db:migrate`): /api/health перевіряє з'єднання з нею.
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile-360',
      use: {
        ...(channel ? { channel } : {}),
        browserName: 'chromium',
        // Мобільний в'юпорт 360×800 заданий вручну, щоб не залежати від пресетів devices.
        viewport: { width: 360, height: 800 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: [
    {
      name: 'api',
      command: 'pnpm --filter api dev',
      url: 'http://localhost:3000/api/health',
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      name: 'web',
      command: 'pnpm --filter web dev',
      url: 'http://localhost:5173',
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
