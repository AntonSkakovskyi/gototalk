import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import i18next from 'eslint-plugin-i18next';
import { createNodeResolver, importX } from 'eslint-plugin-import-x';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

const WEB_SRC = 'apps/web/src';
const API_SRC = 'apps/api/src';
const WEB_SEGMENTS = ['api', 'components', 'hooks', 'lib', 'testing'];
const API_PRIVATE_DIRS = ['persistence', 'lib', 'guards', 'testing', 'audio'];
const API_MODULE_DEPS = {
  auth: [],
  profile: ['auth'],
  'learner-model': ['auth'],
  vocabulary: ['auth'],
  session: ['auth', 'profile', 'learner-model'],
  analysis: ['auth', 'session', 'vocabulary'],
  hint: ['auth', 'session', 'vocabulary'],
  dialogue: ['auth', 'session', 'analysis', 'vocabulary'],
  report: ['auth', 'session', 'analysis', 'vocabulary'],
};

const listDirs = (dir, { required = true } = {}) => {
  const absolute = path.join(import.meta.dirname, dir);
  if (!existsSync(absolute)) {
    if (required) {
      throw new Error(`eslint.config.js: directory not found: ${absolute}`);
    }
    return [];
  }
  return readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
};

const WEB_FEATURES = listDirs(`${WEB_SRC}/features`);
const WEB_ENTITIES = listDirs(`${WEB_SRC}/entities`, { required: false });
const API_MODULES = Object.keys(API_MODULE_DEPS);

for (const dir of listDirs(`${API_SRC}/modules`)) {
  if (!API_MODULES.includes(dir)) {
    throw new Error(
      `eslint.config.js: module "${dir}" has no entry in API_MODULE_DEPS`,
    );
  }
}

const sliceZones = (root, names, message) =>
  names.length < 2
    ? []
    : names.map((name) => ({
        target: `${root}/${name}`,
        from: names
          .filter((other) => other !== name)
          .map((other) => `${root}/${other}`),
        message,
      }));

const featureSubareaZones = WEB_FEATURES.flatMap((feature) => {
  const subareas = listDirs(`${WEB_SRC}/features/${feature}`).filter(
    (dir) => !WEB_SEGMENTS.includes(dir),
  );
  return sliceZones(
    `${WEB_SRC}/features/${feature}`,
    subareas,
    'Feature subareas may not import each other.',
  );
});

const webErrorZones = [
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
  ...sliceZones(
    `${WEB_SRC}/features`,
    WEB_FEATURES,
    'A feature may not import another feature.',
  ),
  {
    target: `${WEB_SRC}/shared/session`,
    from: `${WEB_SRC}/shared/api`,
    message:
      'shared/session is client state only; dependencies go api -> session.',
  },
];

const webDebtZones = [
  {
    target: `${WEB_SRC}/shared`,
    from: `${WEB_SRC}/entities`,
    message: 'shared may not import entities.',
  },
  {
    target: `${WEB_SRC}/entities`,
    from: [`${WEB_SRC}/features`, `${WEB_SRC}/pages`, `${WEB_SRC}/app`],
    message: 'entities may not import features, pages or app.',
  },
  ...sliceZones(
    `${WEB_SRC}/entities`,
    WEB_ENTITIES,
    'An entity may not import another entity.',
  ),
  ...featureSubareaZones,
];

const apiModuleZones = (module) => {
  const target = `${API_SRC}/modules/${module}`;
  const otherModules = API_MODULES.filter((other) => other !== module);
  const allowed = API_MODULE_DEPS[module];
  return [
    {
      target: otherModules.map((other) => `${API_SRC}/modules/${other}`),
      from: API_PRIVATE_DIRS.map((dir) => `${target}/${dir}`),
      message: `${module} keeps ${API_PRIVATE_DIRS.join(', ')} private.`,
    },
    {
      target,
      from: otherModules
        .filter((other) => !allowed.includes(other))
        .map((other) => `${API_SRC}/modules/${other}`),
      message: `${module} may import only: ${allowed.join(', ') || 'nothing'}.`,
    },
  ];
};

const apiZones = [
  ...['core', 'common', 'integrations'].map((layer) => ({
    target: `${API_SRC}/${layer}`,
    from: `${API_SRC}/modules`,
    message: `${layer} may not import modules.`,
  })),
  ...API_MODULES.flatMap(apiModuleZones),
];

const webTestFiles = [
  `${WEB_SRC}/**/*.test.{ts,tsx}`,
  `${WEB_SRC}/shared/testing/**`,
];

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
                'Provider SDKs may only be imported in apps/api/src/integrations/**; everything else goes through ports.',
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
    // Web debt zones are warnings, so they use a second plugin name: severity is per rule, not per zone.
    plugins: { 'import-x-debt': importX },
  },
  {
    files: [`${WEB_SRC}/**/*.{ts,tsx}`],
    ignores: webTestFiles,
    rules: {
      'import-x/no-restricted-paths': [
        'error',
        { basePath: import.meta.dirname, zones: webErrorZones },
      ],
      'import-x-debt/no-restricted-paths': [
        'warn',
        { basePath: import.meta.dirname, zones: webDebtZones },
      ],
      'import-x/no-cycle': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'ImportDeclaration[source.value=/^\\.\\.(\\x2F\\.\\.)+(\\x2F|$)/], ExportAllDeclaration[source.value=/^\\.\\.(\\x2F\\.\\.)+(\\x2F|$)/], ExportNamedDeclaration[source.value=/^\\.\\.(\\x2F\\.\\.)+(\\x2F|$)/]',
          message: 'Use the @/ alias instead of climbing 2+ levels.',
        },
      ],
    },
  },
  {
    files: webTestFiles,
    rules: {
      'import-x-debt/no-restricted-paths': [
        'warn',
        {
          basePath: import.meta.dirname,
          zones: [...webErrorZones, ...webDebtZones],
        },
      ],
    },
  },
  {
    files: [`${API_SRC}/**/*.ts`],
    rules: {
      'import-x/no-restricted-paths': [
        'error',
        { basePath: import.meta.dirname, zones: apiZones },
      ],
      'import-x/no-cycle': 'error',
    },
  },
  {
    files: ['apps/web/src/**/*.tsx'],
    ignores: ['**/*.test.tsx', 'apps/web/src/shared/testing/**'],
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
              'p',
              'tt',
              'align',
              'justify',
              'wrap',
              'spacing',
              'component',
              'data-testid',
            ],
          },
        },
      ],
    },
  },
  {
    files: ['apps/api/src/integrations/**/*.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  prettier,
);
