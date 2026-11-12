import {
  defineConfig,
  minimal2023Preset,
} from '@vite-pwa/assets-generator/config';
import { THEME_COLOR } from './pwa-config.js';

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    transparent: {
      ...minimal2023Preset.transparent,
      padding: 0,
    },
    maskable: {
      ...minimal2023Preset.maskable,
      // Maskable safe zone: the logo shrinks and the margins are filled with the theme colour.
      padding: 0.2,
      resizeOptions: { background: THEME_COLOR, fit: 'contain' },
    },
    apple: {
      ...minimal2023Preset.apple,
      padding: 0,
    },
  },
  images: ['public/favicon.svg'],
});
