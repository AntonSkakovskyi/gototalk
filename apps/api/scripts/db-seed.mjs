import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { requireEnv } from './load-env.mjs';

// Демо-дані для розробки; seed.sql ідемпотентний (ON CONFLICT DO NOTHING) і має власну транзакцію.
const seedFile = fileURLToPath(
  new URL('../../../db/seed.sql', import.meta.url),
);
const client = new pg.Client({ connectionString: requireEnv('DATABASE_URL') });

try {
  await client.connect();
  await client.query(await readFile(seedFile, 'utf8'));
  console.log('Демо-дані застосовано.');
} catch (error) {
  console.error(
    'Не вдалося застосувати демо-дані:',
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
