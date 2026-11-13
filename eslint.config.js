import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import i18next from 'eslint-plugin-i18next';
import { createNodeResolver, importX } from 'eslint-plugin-import-x';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

const WEB_SRC = 'apps/web/src';
const WEB_FEATURES = [
  'auth',
  'session',
  'dialogue',
  'vocabulary',
  'history',
  'report',
  'cards',
  'profile',
];

const webLayerZones = [
  {
    target: `${WEB_SRC}/shared`,
    from: [`${WEB_SRC}/features`, `${WEB_SRC}/pages`, `${WEB_SRC}/app`],
    message: 'shared may not import features, pages or app.',
  },
  {
    target: `${WEB_SRC}/features`,
    from: [`${WEB_SRC}/pages`, `${WEB_SRC}/app`],
    message: 'features may not import pages or app.',
  },
  {
    target: `${WEB_SRC}/pages`,
    from: `${WEB_SRC}/app`,
    message: 'pages may not import app.',
  },
  ...WEB_FEATURES.map((feature) => ({
    target: `${WEB_SRC}/features/${feature}`,
    from: WEB_FEATURES.filter((other) => other !== feature).map(
      (other) => `${WEB_SRC}/features/${other}`,
    ),
    message: 'A feature may not import another feature.',
  })),
  {
    target: `${WEB_SRC}/shared/session`,
    from: `${WEB_SRC}/shared/api`,
    message:
      'shared/session is client state only; dependencies go api -> session.',
  },
];

const apiLayerZones = ['core', 'common', 'integrations'].map((layer) => ({
  target: `apps/api/src/${layer}`,
  from: 'apps/api/src/modules',
  message: `${layer} may not import modules.`,
}));

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
    plugins: { 'import-x': importX },
    settings: {
      'import-x/extensions':
        importX.flatConfigs.typescript.settings['import-x/extensions'],
      'import-x/parsers':
        importX.flatConfigs.typescript.settings['import-x/parsers'],
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          project: ['apps/web/tsconfig.json', 'apps/api/tsconfig.json'],
          noWarnOnMultipleProjects: true,
        }),
        createNodeResolver(),
      ],
    },
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
    files: [`${WEB_SRC}/**/*.{ts,tsx}`],
    ignores: ['**/*.test.{ts,tsx}', `${WEB_SRC}/shared/testing/**`],
    rules: {
      'import-x/no-restricted-paths': [
        'warn',
        { basePath: import.meta.dirname, zones: webLayerZones },
      ],
      'import-x/no-cycle': 'warn',
      'no-restricted-syntax': [
        'warn',
        {
          selector:
            'ImportDeclaration[source.value=/^\\.\\.\\x2F\\.\\.\\x2F/], ExportAllDeclaration[source.value=/^\\.\\.\\x2F\\.\\.\\x2F/], ExportNamedDeclaration[source.value=/^\\.\\.\\x2F\\.\\.\\x2F/]',
          message: 'Use the @/ alias instead of climbing 2+ levels.',
        },
      ],
    },
  },
  {
    files: ['apps/api/src/**/*.ts'],
    rules: {
      'import-x/no-restricted-paths': [
        'warn',
        { basePath: import.meta.dirname, zones: apiLayerZones },
      ],
    },
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
              'gap',
              'ta',
              'autoComplete',
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
