import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireEnv } from './load-env.mjs';

// Generated files are never edited by hand: change the SQL migration and rerun db:pull.
requireEnv('DATABASE_URL');

const apiDir = fileURLToPath(new URL('..', import.meta.url));
const pullDir = join(apiDir, '.drizzle-pull');
const targetDir = join(apiDir, 'src', 'db');
const drizzleKitBin = join(apiDir, 'node_modules', 'drizzle-kit', 'bin.cjs');
const prettierBin = join(
  apiDir,
  '..',
  '..',
  'node_modules',
  'prettier',
  'bin',
  'prettier.cjs',
);
const files = ['schema.ts', 'relations.ts'];

// Binaries run through node without a shell because pnpm is a .cmd wrapper on Windows.
function run(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: apiDir,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    console.error(`Command ${script} failed.`);
    process.exit(result.status ?? 1);
  }
}

rmSync(pullDir, { recursive: true, force: true });
run(drizzleKitBin, ['pull', '--config=drizzle.pull.config.ts']);

mkdirSync(targetDir, { recursive: true });
for (const file of files) {
  // NodeNext needs .js extensions in relative imports; drizzle-kit omits them.
  const code = readFileSync(join(pullDir, file), 'utf8').replace(
    /from (['"])\.\/schema\1/g,
    'from $1./schema.js$1',
  );
  writeFileSync(join(targetDir, file), code);
}
rmSync(pullDir, { recursive: true, force: true });

// Prettier keeps the output stable, so a repeated pull produces no diff.
run(prettierBin, ['--write', ...files.map((f) => `src/db/${f}`)]);
console.log('Schema updated: apps/api/src/db/schema.ts, relations.ts');
