import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import { pwaOptions } from './pwa-config.js';

const API_TARGET = 'http://localhost:3000';

const apiProxy = {
  '/api': { target: API_TARGET, changeOrigin: true },
};

export default defineConfig({
  plugins: [react(), VitePWA(pwaOptions)],
  server: {
    // Explicit IPv4: on Windows Vite binds localhost only to [::1], while adb reverse connects to 127.0.0.1.
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
