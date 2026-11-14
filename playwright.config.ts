import { defineConfig } from '@playwright/test';

// Locally e2e runs in Microsoft Edge (preinstalled on Windows, no browser download); CI uses Playwright Chromium.
// Override the channel with PW_CHANNEL.
const channel = process.env.PW_CHANNEL ?? (process.env.CI ? '' : 'msedge');

// e2e needs the database up because /api/health checks the connection.
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  // argon2 is memory- and CPU-heavy (64 MiB, 4 lanes), so many parallel workers starve the dev servers.
  workers: 2,
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
        viewport: { width: 360, height: 800 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        permissions: ['microphone'],
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
          ],
        },
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
