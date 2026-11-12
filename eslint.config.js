import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';
import i18next from 'eslint-plugin-i18next';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: [
      '**/dist/**',
      '**/dev-dist/**',
      '**/coverage/**',
      '**/.drizzle-pull/**',
      '**/playwright-report/**',
      '**/test-results/**',
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
    // Жодного тексту інтерфейсу прямо в JSX: лише через i18n (uk.json).
    files: ['apps/web/src/**/*.tsx'],
    ignores: ['**/*.test.tsx', 'apps/web/src/test-utils.tsx'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-only',
          // Службові атрибути, що не є текстом інтерфейсу. aria-label, label,
          // placeholder, title, alt та інші текстові пропси лишаються під контролем.
          'jsx-attributes': {
            exclude: [
              'className',
              'path',
              'to',
              'key',
              'id',
              'type',
              'role',
              'size',
              'variant',
              'order',
              'fw',
              'c',
              'color',
              'radius',
              'component',
              'data-testid',
            ],
          },
        },
      ],
    },
  },
  {
    files: ['apps/api/src/adapters/**/*.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  prettier,
);
