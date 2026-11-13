import type pg from 'pg';

const POLL_INTERVAL_MS = 20;
const WAIT_TIMEOUT_MS = 5000;

/** Holds FOR UPDATE on the session row from a second connection until it is released. */
export class SessionLockHolder {
  private constructor(
    private readonly client: pg.PoolClient,
    private readonly sessionId: string,
  ) {}

  static async acquire(
    pool: pg.Pool,
    sessionId: string,
  ): Promise<SessionLockHolder> {
    const client = await pool.connect();
    await client.query('BEGIN');
    await client.query('SELECT id FROM sessions WHERE id = $1 FOR UPDATE', [
      sessionId,
    ]);
    return new SessionLockHolder(client, sessionId);
  }

  async finishAndRelease(): Promise<void> {
    await this.client.query(
      `UPDATE sessions SET status = 'finished', ended_at = now() WHERE id = $1`,
      [this.sessionId],
    );
    await this.release();
  }

  async release(): Promise<void> {
    try {
      await this.client.query('COMMIT');
    } finally {
      this.client.release();
    }
  }
}

/** Resolves once at least `count` other backends of the test database are blocked on a row lock. */
export async function waitForLockWaiters(
  pool: pg.Pool,
  count: number,
): Promise<void> {
  const deadline = Date.now() + WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const { rows } = await pool.query(
      `SELECT 1 FROM pg_stat_activity
        WHERE datname = current_database() AND pid <> pg_backend_pid()
          AND wait_event_type = 'Lock'`,
    );
    if (rows.length >= count) return;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(`Fewer than ${count} backends started waiting on a lock`);
}

export function waitForLockWaiter(pool: pg.Pool): Promise<void> {
  return waitForLockWaiters(pool, 1);
}
