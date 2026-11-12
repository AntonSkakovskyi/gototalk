import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/.drizzle-pull/**',
      '**/node_modules/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Доменний код не імпортує SDK провайдерів: вони доступні лише адаптерам портів.
    files: ['**/*.{ts,tsx,js,mjs}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@deepgram/*', '@google/genai', '@google/generative-ai'],
              message:
                'SDK провайдерів імпортуються лише в apps/api/src/adapters/**; решта коду працює через порти.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ['apps/api/src/adapters/**/*.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  prettier,
);
