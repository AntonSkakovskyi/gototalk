import { DEFAULT_THEME, mergeMantineTheme } from '@mantine/core';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import viteConfig from './vite.config.js';
import { manifest, pwaOptions, THEME_COLOR } from './pwa-config.js';
import { theme } from './src/theme.js';

const root = import.meta.dirname;

describe('PWA', () => {
  it('[TC-00-03] theme_color matches the Mantine primary colour', () => {
    const merged = mergeMantineTheme(DEFAULT_THEME, theme);
    const shade = merged.primaryShade;
    const light = typeof shade === 'number' ? shade : shade.light;

    expect(merged.colors[merged.primaryColor]?.[light]).toBe(THEME_COLOR);
    expect(manifest.theme_color).toBe(THEME_COLOR);
  });

  it('[TC-00-03] <meta name="theme-color"> in index.html matches theme_color', () => {
    const html = readFileSync(resolve(root, 'index.html'), 'utf8');
    const match = /<meta\s+name="theme-color"\s+content="([^"]+)"/.exec(html);

    expect(match?.[1]).toBe(manifest.theme_color);
  });

  it('[TC-00-03] manifest: name, language, display mode and colours', () => {
    expect(manifest).toMatchObject({
      name: 'GoToTalk',
      short_name: 'GoToTalk',
      lang: 'uk',
      display: 'standalone',
    });
    expect(manifest.description).toBeTruthy();
    expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('[TC-00-03] manifest: 192, 512 and maskable icons exist in public', () => {
    const icons = manifest.icons ?? [];

    expect(
      icons.some((i) => i.sizes === '192x192' && i.purpose === undefined),
    ).toBe(true);
    expect(
      icons.some((i) => i.sizes === '512x512' && i.purpose === undefined),
    ).toBe(true);
    expect(
      icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable'),
    ).toBe(true);
    for (const icon of icons) {
      expect(existsSync(resolve(root, 'public', icon.src)), icon.src).toBe(
        true,
      );
    }
    expect(existsSync(resolve(root, 'public/favicon.ico'))).toBe(true);
    expect(
      existsSync(resolve(root, 'public/apple-touch-icon-180x180.png')),
    ).toBe(true);
  });

  it('[TC-00-03] plugin: autoUpdate and service worker in dev', () => {
    expect(pwaOptions.registerType).toBe('autoUpdate');
    expect(pwaOptions.devOptions?.enabled).toBe(true);
  });

  it('[TC-00-03] service worker does not intercept /api', () => {
    const denylist = pwaOptions.workbox?.navigateFallbackDenylist ?? [];

    expect(denylist.some((re) => re.test('/api/health'))).toBe(true);
    expect(denylist.some((re) => re.test('/api/docs'))).toBe(true);
    expect(denylist.some((re) => re.test('/words'))).toBe(false);
    expect(pwaOptions.workbox?.runtimeCaching ?? []).toEqual([]);
  });

  it('[TC-00-03] preview.proxy mirrors server.proxy for /api', () => {
    expect(viteConfig.preview?.proxy).toBeDefined();
    expect(viteConfig.preview?.proxy).toEqual(viteConfig.server?.proxy);
    expect(viteConfig.preview?.proxy?.['/api']).toMatchObject({
      target: 'http://localhost:3000',
    });
  });
});
