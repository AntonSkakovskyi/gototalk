import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { InMemoryRefreshTokensRepository } from './testing/in-memory-refresh-tokens.repository.js';
import {
  InvalidRefreshTokenError,
  TokenReusedError,
} from './refresh-token.errors.js';
import {
  REFRESH_REUSE_GRACE_MS,
  REFRESH_TOKEN_TTL_MS,
  RefreshTokenService,
} from './refresh-token.service.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';

function setup() {
  let current = new Date('2026-11-13T10:00:00.000Z');
  const repository = new InMemoryRefreshTokensRepository();
  const service = new RefreshTokenService(repository, () => current);
  return {
    repository,
    service,
    advance: (ms: number) => {
      current = new Date(current.getTime() + ms);
    },
    now: () => current,
  };
}

describe('RefreshTokenService', () => {
  it('[TC-01-01] issues a distinct 43-char base64url token valid for 30 days', async () => {
    const { service, now } = setup();

    const first = await service.issue(USER_ID);
    const second = await service.issue(USER_ID);

    expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.token).not.toBe(second.token);
    expect(first.expiresAt.getTime()).toBe(
      now().getTime() + REFRESH_TOKEN_TTL_MS,
    );
    expect(REFRESH_TOKEN_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('[TC-01-01] stores only the sha-256 hash, never the raw token', async () => {
    const { service, repository } = setup();

    const { token } = await service.issue(USER_ID);

    expect(repository.rows).toHaveLength(1);
    const [row] = repository.rows;
    expect(row?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.tokenHash).toBe(
      createHash('sha256').update(token).digest('hex'),
    );
    expect(JSON.stringify(repository.rows)).not.toContain(token);
  });

  it('[TC-01-01] rotate issues a new token and revokes the old one', async () => {
    const { service, repository, advance, now } = setup();
    const old = await service.issue(USER_ID);
    advance(1000);

    const rotated = await service.rotate(old.token);

    expect(rotated.userId).toBe(USER_ID);
    expect(rotated.token).not.toBe(old.token);
    expect(rotated.expiresAt.getTime()).toBe(
      now().getTime() + REFRESH_TOKEN_TTL_MS,
    );
    expect(repository.rows).toHaveLength(2);
    const [oldRow, newRow] = repository.rows;
    expect(oldRow?.revokedAt).toEqual(now());
    expect(newRow?.revokedAt).toBeNull();
    expect(newRow?.userId).toBe(USER_ID);
    expect(JSON.stringify(repository.rows)).not.toContain(rotated.token);
  });

  it('[TC-01-01] the rotated token can be rotated again', async () => {
    const { service } = setup();
    const first = await service.issue(USER_ID);

    const second = await service.rotate(first.token);
    const third = await service.rotate(second.token);

    expect(third.userId).toBe(USER_ID);
    expect(third.token).not.toBe(second.token);
  });

  it('[TC-01-01] a replay within the grace period returns a new valid token and revokes nothing', async () => {
    const { service, repository, advance } = setup();
    const old = await service.issue(USER_ID);
    const successor = await service.rotate(old.token);
    advance(REFRESH_REUSE_GRACE_MS - 1);

    const sibling = await service.rotate(old.token);

    expect(sibling.userId).toBe(USER_ID);
    expect(sibling.token).not.toBe(successor.token);
    expect(sibling.token).not.toBe(old.token);
    expect(repository.rows).toHaveLength(3);
    expect(repository.rows.filter((r) => r.revokedAt !== null)).toHaveLength(1);
    await expect(service.rotate(successor.token)).resolves.toMatchObject({
      userId: USER_ID,
    });
    await expect(service.rotate(sibling.token)).resolves.toMatchObject({
      userId: USER_ID,
    });
  });

  it('[TC-01-01] a replay exactly at the end of the grace period is still accepted', async () => {
    const { service, advance } = setup();
    const old = await service.issue(USER_ID);
    await service.rotate(old.token);
    advance(REFRESH_REUSE_GRACE_MS);

    await expect(service.rotate(old.token)).resolves.toMatchObject({
      userId: USER_ID,
    });
  });

  it('[TC-01-01] a replay after the grace period throws TokenReused and deletes all tokens of that user only', async () => {
    const { service, repository, advance } = setup();
    const old = await service.issue(USER_ID);
    const otherDevice = await service.issue(USER_ID);
    const fresh = await service.rotate(old.token);
    const foreign = await service.issue(OTHER_USER_ID);
    advance(REFRESH_REUSE_GRACE_MS + 1);

    await expect(service.rotate(old.token)).rejects.toBeInstanceOf(
      TokenReusedError,
    );

    expect(repository.rows.filter((r) => r.userId === USER_ID)).toHaveLength(0);
    await expect(service.rotate(fresh.token)).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
    await expect(service.rotate(otherDevice.token)).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
    expect(repository.rows).toHaveLength(1);
    await expect(service.rotate(foreign.token)).resolves.toMatchObject({
      userId: OTHER_USER_ID,
    });
  });

  it('[TC-01-01] a replay after a reuse wipe is just an unknown token', async () => {
    const { service, advance } = setup();
    const old = await service.issue(USER_ID);
    await service.rotate(old.token);
    advance(REFRESH_REUSE_GRACE_MS + 1);
    await expect(service.rotate(old.token)).rejects.toBeInstanceOf(
      TokenReusedError,
    );

    await expect(service.rotate(old.token)).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
  });

  it('[TC-01-01] an expired token throws InvalidRefreshToken without reuse side effects', async () => {
    const { service, repository, advance } = setup();
    const expired = await service.issue(USER_ID);
    advance(1000);
    const live = await service.issue(USER_ID);
    advance(REFRESH_TOKEN_TTL_MS - 1000);

    await expect(service.rotate(expired.token)).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );

    expect(repository.rows).toHaveLength(2);
    expect(repository.rows.every((r) => r.revokedAt === null)).toBe(true);
    await expect(service.rotate(live.token)).resolves.toMatchObject({
      userId: USER_ID,
    });
  });

  it('[TC-01-01] an unknown token throws InvalidRefreshToken and changes nothing', async () => {
    const { service, repository } = setup();
    await service.issue(USER_ID);

    await expect(service.rotate('x'.repeat(43))).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );

    expect(repository.rows).toHaveLength(1);
    expect(repository.rows[0]?.revokedAt).toBeNull();
  });

  it('[TC-01-01] revoke deletes the token, is idempotent and leaves other sessions intact', async () => {
    const { service, repository } = setup();
    const { token } = await service.issue(USER_ID);
    const otherSession = await service.issue(USER_ID);

    await service.revoke(token);
    await service.revoke(token);

    expect(repository.rows).toHaveLength(1);
    await expect(service.rotate(token)).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
    await expect(service.rotate(otherSession.token)).resolves.toMatchObject({
      userId: USER_ID,
    });
  });

  it('[TC-01-01] a replay after logout is an invalid token even within the grace period and keeps other sessions', async () => {
    const { service, repository } = setup();
    const first = await service.issue(USER_ID);
    const rotated = await service.rotate(first.token);
    const otherSession = await service.issue(USER_ID);
    await service.revoke(first.token);
    await service.revoke(rotated.token);

    await expect(service.rotate(first.token)).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );

    expect(repository.rows).toHaveLength(1);
    await expect(service.rotate(otherSession.token)).resolves.toMatchObject({
      userId: USER_ID,
    });
  });

  it('[TC-01-01] concurrent rotate of the same token succeeds for both callers with distinct tokens', async () => {
    const { service } = setup();
    const { token } = await service.issue(USER_ID);

    const [a, b] = await Promise.all([
      service.rotate(token),
      service.rotate(token),
    ]);

    expect(a.userId).toBe(USER_ID);
    expect(b.userId).toBe(USER_ID);
    expect(a.token).not.toBe(b.token);
    await expect(service.rotate(a.token)).resolves.toBeDefined();
    await expect(service.rotate(b.token)).resolves.toBeDefined();
  });

  it('[TC-01-01] an expired token that was already rotated is invalid, not reuse', async () => {
    const { service, repository, advance } = setup();
    const old = await service.issue(USER_ID);
    const successor = await service.rotate(old.token);
    advance(REFRESH_TOKEN_TTL_MS);

    await expect(service.rotate(old.token)).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );

    expect(repository.rows).toHaveLength(2);
    await expect(service.rotate(successor.token)).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
  });

  it('[TC-01-01] revoke does not throw for an unknown token', async () => {
    const { service, repository } = setup();

    await expect(service.revoke('unknown')).resolves.toBeUndefined();

    expect(repository.rows).toHaveLength(0);
  });
});
