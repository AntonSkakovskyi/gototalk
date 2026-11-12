import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import { pwaOptions } from './pwa-config.js';

const API_TARGET = 'http://localhost:3000';

// Бекенд доступний фронту через проксі, окремий порт на пристрій не прокидаємо.
const apiProxy = {
  '/api': { target: API_TARGET, changeOrigin: true },
};

export default defineConfig({
  plugins: [react(), VitePWA(pwaOptions)],
  server: {
    // Явний IPv4-loopback: на Windows `localhost` у Vite лишається лише на [::1],
    // а `adb reverse` стукає на 127.0.0.1 і отримує ERR_EMPTY_RESPONSE.
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: apiProxy,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
    proxy: apiProxy,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
