import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { requireEnv } from './load-env.mjs';

const seedFile = fileURLToPath(
  new URL('../../../db/seed.sql', import.meta.url),
);
const client = new pg.Client({ connectionString: requireEnv('DATABASE_URL') });

try {
  await client.connect();
  await client.query(await readFile(seedFile, 'utf8'));
  console.log('Seed data applied.');
} catch (error) {
  console.error(
    'Failed to apply seed data:',
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
