import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { requireEnv } from './load-env.mjs';

const migrationsFolder = fileURLToPath(
  new URL('../../../db/migrations', import.meta.url),
);
const pool = new pg.Pool({ connectionString: requireEnv('DATABASE_URL') });

try {
  await migrate(drizzle(pool), { migrationsFolder });
  console.log('Migrations applied.');
} catch (error) {
  console.error(
    'Failed to apply migrations:',
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
