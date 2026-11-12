import {
  defineConfig,
  minimal2023Preset,
} from '@vite-pwa/assets-generator/config';
import { THEME_COLOR } from './pwa-config.js';

// Генерує PNG-іконки й favicon.ico з public/favicon.svg у public/.
// Запуск: pnpm --filter web generate-pwa-assets; результат комітиться.
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    transparent: {
      ...minimal2023Preset.transparent,
      // Логотип займає весь квадрат: фон SVG і так суцільний.
      padding: 0,
    },
    maskable: {
      ...minimal2023Preset.maskable,
      // Безпечна зона maskable: логотип зменшується, поля заливаються кольором теми.
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
