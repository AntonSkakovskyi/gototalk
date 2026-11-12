import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireEnv } from './load-env.mjs';

// Інтроспекція БД (з уже застосованими міграціями) → apps/api/src/db/{schema,relations}.ts.
// Згенеровані файли вручну не правимо: змінюємо SQL-міграцію й повторюємо db:pull.
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

// Бінарники викликаємо напряму через node, без shell (на Windows pnpm є .cmd-обгорткою).
function run(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: apiDir,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    console.error(`Команда ${script} завершилась з помилкою.`);
    process.exit(result.status ?? 1);
  }
}

rmSync(pullDir, { recursive: true, force: true });
run(drizzleKitBin, ['pull', '--config=drizzle.pull.config.ts']);

mkdirSync(targetDir, { recursive: true });
for (const file of files) {
  // NodeNext-резолюція вимагає розширення у відносних імпортах; drizzle-kit його не ставить.
  const code = readFileSync(join(pullDir, file), 'utf8').replace(
    /from (['"])\.\/schema\1/g,
    'from $1./schema.js$1',
  );
  writeFileSync(join(targetDir, file), code);
}
rmSync(pullDir, { recursive: true, force: true });

// Формат Prettier робить вивід стабільним, повторний pull не дає diff.
run(prettierBin, ['--write', ...files.map((f) => `src/db/${f}`)]);
console.log('Схему оновлено: apps/api/src/db/schema.ts, relations.ts');
