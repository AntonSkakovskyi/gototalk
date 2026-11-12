import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// esbuild does not emit decorator metadata, so tests are compiled with SWC (Nest recipe).
const plugins = [swc.vite({ module: { type: 'es6' } })];

export default defineConfig({
  test: {
    projects: [
      {
        plugins,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts', 'test/support/**/*.test.ts'],
        },
      },
      {
        plugins,
        test: {
          name: 'integration',
          include: ['test/**/*.test.ts'],
          exclude: ['test/support/**'],
          fileParallelism: false,
          globalSetup: ['test/global-setup.ts'],
        },
      },
    ],
  },
});
