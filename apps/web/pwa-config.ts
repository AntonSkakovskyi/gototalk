import type { ManifestOptions, VitePWAOptions } from 'vite-plugin-pwa';

// Єдине джерело кольору PWA: значення для <meta name="theme-color"> в index.html
// і theme_color у маніфесті. Збігається з primaryColor ('blue', відтінок 6) теми
// Mantine; збіг з темою й з index.html перевіряє pwa-config.test.ts.
export const THEME_COLOR = '#228be6';
export const BACKGROUND_COLOR = '#ffffff';

// Іконки генерує pnpm --filter web generate-pwa-assets (pwa-assets.config.ts) у public/.
export const manifest: Partial<ManifestOptions> = {
  name: 'GoToTalk',
  short_name: 'GoToTalk',
  description: 'Тренер говоріння англійською для україномовних користувачів',
  lang: 'uk',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  theme_color: THEME_COLOR,
  background_color: BACKGROUND_COLOR,
  icons: [
    { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
    { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
    { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
    {
      src: 'maskable-icon-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
};

export const pwaOptions: Partial<VitePWAOptions> = {
  registerType: 'autoUpdate',
  includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
  manifest,
  workbox: {
    // /api (REST, Swagger) не підміняється на index.html; runtime-кешу для API немає.
    navigateFallbackDenylist: [/^\/api\//],
  },
  devOptions: {
    enabled: true,
    // У dev service worker віддає лише index.html для навігації.
    navigateFallbackAllowlist: [/^\/$/],
  },
};
