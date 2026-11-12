import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const API_TARGET = 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Бекенд доступний фронту через проксі, окремий порт на пристрій не прокидаємо.
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
