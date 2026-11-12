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
    // Provider SDKs are reserved for port adapters so domain code stays provider-agnostic.
    files: ['**/*.{ts,tsx,js,mjs}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@deepgram/*', '@google/genai', '@google/generative-ai'],
              message:
                'Provider SDKs may only be imported in apps/api/src/adapters/**; everything else goes through ports.',
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
    files: ['apps/web/src/**/*.tsx'],
    ignores: ['**/*.test.tsx', 'apps/web/src/test-utils.tsx'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-only',
          // Excluded attributes carry no UI text; text props (aria-label, label, placeholder, title, alt) stay checked.
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
