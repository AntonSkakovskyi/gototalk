import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  inject,
  it,
} from 'vitest';
import { DrizzleRefreshTokensRepository } from '../../../src/modules/auth/persistence/drizzle-refresh-tokens.repository.js';
import { dbSchema } from '../../../src/core/db/db.tokens.js';
import { resetUserData } from '../../support/test-db.js';

const NOW = new Date('2026-11-13T10:00:00.000Z');
const HOUR = 60 * 60 * 1000;

describe('DrizzleRefreshTokensRepository', () => {
  let pool: pg.Pool;
  let repository: DrizzleRefreshTokensRepository;
  let userId: string;

  beforeAll(() => {
    pool = new pg.Pool({ connectionString: inject('testDatabaseUrl') });
    repository = new DrizzleRefreshTokensRepository(
      drizzle({ client: pool, schema: dbSchema }),
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await resetUserData(pool);
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO users (email, password_hash) VALUES ($1, 'x') RETURNING id`,
      [`${randomUUID()}@example.com`],
    );
    userId = rows[0]?.id ?? '';
  });

  async function insertToken(
    hash: string,
    expiresAt = new Date(NOW.getTime() + HOUR),
  ) {
    await repository.insert({ userId, tokenHash: hash, expiresAt });
  }

  async function revokedAt(hash: string): Promise<Date | null> {
    return (await repository.findByHash(hash))?.revokedAt ?? null;
  }

  it('[TC-01-01] findByHash maps timestamps to Date and returns null for an unknown hash', async () => {
    const expiresAt = new Date(NOW.getTime() + HOUR);
    await insertToken('hash-a', expiresAt);

    const found = await repository.findByHash('hash-a');

    expect(found?.userId).toBe(userId);
    expect(found?.expiresAt).toBeInstanceOf(Date);
    expect(found?.expiresAt.getTime()).toBe(expiresAt.getTime());
    expect(found?.revokedAt).toBeNull();
    expect(await repository.findByHash('missing')).toBeNull();
  });

  it('[TC-01-01] rotateActive revokes the old token with the passed now and inserts the next one', async () => {
    await insertToken('old');
    const nextExpiry = new Date(NOW.getTime() + 2 * HOUR);

    const result = await repository.rotateActive(
      'old',
      { tokenHash: 'new', expiresAt: nextExpiry },
      NOW,
    );

    expect(result).toEqual({ userId });
    expect((await revokedAt('old'))?.getTime()).toBe(NOW.getTime());
    const created = await repository.findByHash('new');
    expect(created?.userId).toBe(userId);
    expect(created?.revokedAt).toBeNull();
    expect(created?.expiresAt.getTime()).toBe(nextExpiry.getTime());
  });

  it('[TC-01-01] rotateActive returns null and inserts nothing for revoked, expired and unknown tokens', async () => {
    await insertToken('revoked');
    await pool.query(
      `UPDATE refresh_tokens SET revoked_at = $1 WHERE token_hash = 'revoked'`,
      [NOW.toISOString()],
    );
    await insertToken('expired', new Date(NOW.getTime() - 1));
    const next = {
      tokenHash: 'next',
      expiresAt: new Date(NOW.getTime() + HOUR),
    };

    expect(await repository.rotateActive('revoked', next, NOW)).toBeNull();
    expect(await repository.rotateActive('expired', next, NOW)).toBeNull();
    expect(await repository.rotateActive('unknown', next, NOW)).toBeNull();
    expect(await repository.findByHash('next')).toBeNull();
  });

  it('[TC-01-01] rotateActive rolls back the revocation when the insert fails', async () => {
    await insertToken('old');
    await insertToken('taken');

    await expect(
      repository.rotateActive(
        'old',
        { tokenHash: 'taken', expiresAt: new Date(NOW.getTime() + HOUR) },
        NOW,
      ),
    ).rejects.toThrow();

    expect(await revokedAt('old')).toBeNull();
  });

  it('[TC-01-02] two parallel rotations of one token: exactly one wins', async () => {
    await insertToken('old');
    const expiresAt = new Date(NOW.getTime() + HOUR);

    const results = await Promise.all([
      repository.rotateActive('old', { tokenHash: 'n1', expiresAt }, NOW),
      repository.rotateActive('old', { tokenHash: 'n2', expiresAt }, NOW),
    ]);

    expect(results.filter((r) => r !== null)).toHaveLength(1);
    const created =
      (await repository.findByHash('n1')) ??
      (await repository.findByHash('n2'));
    expect(created).not.toBeNull();
    const { rows } = await pool.query(
      `SELECT 1 FROM refresh_tokens WHERE token_hash IN ('n1', 'n2')`,
    );
    expect(rows).toHaveLength(1);
  });

  it('[TC-01-01] deleteByHash removes only the matching row and is idempotent', async () => {
    await insertToken('a');
    await insertToken('b');

    await repository.deleteByHash('a');
    await repository.deleteByHash('a');
    await repository.deleteByHash('missing');

    expect(await repository.findByHash('a')).toBeNull();
    expect(await repository.findByHash('b')).not.toBeNull();
  });

  it('[TC-01-01] deleteAllForUser removes every token of that user, revoked or not, and no one else', async () => {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO users (email, password_hash) VALUES ($1, 'x') RETURNING id`,
      [`${randomUUID()}@example.com`],
    );
    const otherId = rows[0]?.id ?? '';
    await insertToken('mine-1');
    await insertToken('mine-2');
    await repository.rotateActive(
      'mine-2',
      { tokenHash: 'mine-3', expiresAt: new Date(NOW.getTime() + HOUR) },
      NOW,
    );
    await repository.insert({
      userId: otherId,
      tokenHash: 'theirs',
      expiresAt: new Date(NOW.getTime() + HOUR),
    });

    await repository.deleteAllForUser(userId);

    for (const hash of ['mine-1', 'mine-2', 'mine-3']) {
      expect(await repository.findByHash(hash)).toBeNull();
    }
    expect(await repository.findByHash('theirs')).not.toBeNull();
  });
});
