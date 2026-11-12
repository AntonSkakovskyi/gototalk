import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { PasswordHasher } from './password-hasher.js';

const seedSql = readFileSync(
  new URL('../../../../db/seed.sql', import.meta.url),
  'utf8',
);
const demoHash = /'(\$argon2id\$[^']+)'/.exec(seedSql)?.[1];
if (!demoHash) {
  throw new Error('demo hash not found in db/seed.sql');
}

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();

  it('[TC-01-01] hashes with argon2id and the seed parameters', async () => {
    const hash = await hasher.hash('correct horse');

    expect(hash).not.toBe('correct horse');
    expect(hash.startsWith('$argon2id$v=19$m=65536,t=3,p=4$')).toBe(true);
  });

  it('[TC-01-01] verifies the right password and rejects a wrong one', async () => {
    const hash = await hasher.hash('correct horse');

    await expect(hasher.verify(hash, 'correct horse')).resolves.toBe(true);
    await expect(hasher.verify(hash, 'wrong horse')).resolves.toBe(false);
  });

  it('[TC-01-01] verifies the demo user hash from db/seed.sql', async () => {
    await expect(hasher.verify(demoHash, 'demo-password-1')).resolves.toBe(
      true,
    );
    await expect(hasher.verify(demoHash, 'demo-password-2')).resolves.toBe(
      false,
    );
  });

  it('[TC-01-01] produces different hashes for the same password (salt)', async () => {
    const [first, second] = await Promise.all([
      hasher.hash('same'),
      hasher.hash('same'),
    ]);

    expect(first).not.toBe(second);
  });

  it('[TC-01-01] returns false for a malformed hash instead of throwing', async () => {
    await expect(hasher.verify('not-a-hash', 'password')).resolves.toBe(false);
    await expect(hasher.verify('', 'password')).resolves.toBe(false);
    await expect(hasher.verify('$argon2id$garbage', 'password')).resolves.toBe(
      false,
    );
  });

  it('[TC-01-01] verifyDummy always returns false and runs a real argon2id verify', async () => {
    const spy = vi.spyOn(hasher, 'verify');

    await expect(hasher.verifyDummy('password')).resolves.toBe(false);

    expect(spy).toHaveBeenCalledWith(
      expect.stringMatching(/^\$argon2id\$v=19\$m=65536,t=3,p=4\$/),
      'password',
    );
    spy.mockRestore();
  });
});
