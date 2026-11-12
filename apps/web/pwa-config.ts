import type { ManifestOptions, VitePWAOptions } from 'vite-plugin-pwa';

// Single source of the PWA colour; pwa-config.test.ts checks it against the Mantine theme and index.html.
export const THEME_COLOR = '#228be6';
export const BACKGROUND_COLOR = '#ffffff';

export const manifest: Partial<ManifestOptions> = {
  name: 'GoToTalk',
  short_name: 'GoToTalk',
  description: 'English speaking trainer for Ukrainian-speaking users',
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
    navigateFallbackDenylist: [/^\/api\//],
  },
  devOptions: {
    enabled: true,
    navigateFallbackAllowlist: [/^\/$/],
  },
};
