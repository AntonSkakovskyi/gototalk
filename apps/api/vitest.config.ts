import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Esbuild не емітить метадані декораторів, тому, як радить документація Nest (recipes/swc),
// файли збираються через SWC.
const plugins = [swc.vite({ module: { type: 'es6' } })];

export default defineConfig({
  test: {
    // Інтеграційні тести з'являються в задачі 00-09
    passWithNoTests: true,
    projects: [
      {
        plugins,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        plugins,
        test: {
          name: 'integration',
          include: ['test/**/*.test.ts'],
        },
      },
    ],
  },
});
