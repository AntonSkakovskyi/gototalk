import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    testDatabaseUrl: string;
  }
}

const migrationsFolder = fileURLToPath(
  new URL('../../../db/migrations', import.meta.url),
);

// Єдиний .env у корені репозиторію. Відсутній файл не помилка (у CI змінні приходять із середовища).
// Файл лише розбирається (не loadEnvFile): інакше змінні потрапили б у process.env воркерів і
// ConfigService у unit-тестах віддавав би їх замість явно переданого env.
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

/** Застосовує міграції до TEST_DATABASE_URL і передає URL тестам через `inject('testDatabaseUrl')`. */
export default async function setup(project: TestProject): Promise<void> {
  // Змінні процесу (CI, ручне перевизначення) мають пріоритет над .env
  const url =
    process.env['TEST_DATABASE_URL'] ?? readRootEnv()['TEST_DATABASE_URL'];
  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL не задано: інтеграційним тестам потрібна окрема БД gototalk_test (див. .env.example, `podman compose up -d`).',
    );
  }

  const pool = new pg.Pool({ connectionString: url });
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder });
  } finally {
    await pool.end();
  }

  project.provide('testDatabaseUrl', url);
}
