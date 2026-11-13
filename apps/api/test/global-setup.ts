import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import type { TestProject } from 'vitest/node';
import {
  assertConnectedToTestDatabase,
  assertTestDatabaseUrl,
} from './support/test-db.js';

declare module 'vitest' {
  export interface ProvidedContext {
    testDatabaseUrl: string;
  }
}

const migrationsFolder = fileURLToPath(
  new URL('../../../db/migrations', import.meta.url),
);

// The .env is parsed, not loaded, to keep it out of worker process.env: otherwise
// ConfigService in unit tests would return it instead of the explicitly passed env.
function readRootEnv(): Record<string, string | undefined> {
  try {
    const file = readFileSync(
      fileURLToPath(new URL('../../../.env', import.meta.url)),
      'utf8',
    );
    return parseEnv(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
    return {};
  }
}

export default async function setup(project: TestProject): Promise<void> {
  // Process env takes priority over .env (CI, manual override).
  const url =
    process.env['TEST_DATABASE_URL'] ?? readRootEnv()['TEST_DATABASE_URL'];
  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL is not set: integration tests need a separate gototalk_test database (see .env.example, `podman compose up -d`).',
    );
  }

  assertTestDatabaseUrl(url);

  const pool = new pg.Pool({ connectionString: url });
  try {
    // pg can take the database from other connection parameters, so the URL check alone is not enough
    await assertConnectedToTestDatabase(pool);
    await migrate(drizzle({ client: pool }), { migrationsFolder });
  } finally {
    await pool.end();
  }

  project.provide('testDatabaseUrl', url);
}
