import type pg from 'pg';

const TEST_DATABASE_SUFFIX = '_test';

function assertTestDatabaseName(name: string): void {
  if (!name.endsWith(TEST_DATABASE_SUFFIX)) {
    throw new Error(
      `Refusing to run: the database name "${name}" must end with "${TEST_DATABASE_SUFFIX}". Integration tests truncate user tables, so they must never point at the dev database.`,
    );
  }
}

export function assertTestDatabaseUrl(url: string): void {
  let name: string;
  try {
    name = decodeURIComponent(new URL(url).pathname.slice(1));
  } catch {
    // The original error is dropped on purpose: it can echo the URL with credentials
    throw new Error(
      'The database URL is not valid (credentials are not shown).',
    );
  }
  assertTestDatabaseName(name);
}

export async function assertConnectedToTestDatabase(
  pool: pg.Pool,
): Promise<void> {
  const { rows } = await pool.query<{ name: string }>(
    'SELECT current_database() AS name',
  );
  assertTestDatabaseName(rows[0]?.name ?? '');
}

export async function resetUserData(pool: pg.Pool): Promise<void> {
  await assertConnectedToTestDatabase(pool);
  await pool.query('TRUNCATE users CASCADE');
}
