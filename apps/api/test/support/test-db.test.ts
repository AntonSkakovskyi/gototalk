import { describe, expect, it } from 'vitest';
import { assertTestDatabaseUrl } from './test-db.js';

describe('assertTestDatabaseUrl', () => {
  it('[TC-00-04] rejects the dev database with an explanation', () => {
    expect(() =>
      assertTestDatabaseUrl('postgres://user:pass@localhost:5432/gototalk'),
    ).toThrow(/_test/);
  });

  it('[TC-00-04] accepts a database whose name ends with _test', () => {
    expect(() =>
      assertTestDatabaseUrl(
        'postgres://user:pass@localhost:5432/gototalk_test',
      ),
    ).not.toThrow();
  });

  it('[TC-00-04] ignores the query string when reading the database name', () => {
    expect(() =>
      assertTestDatabaseUrl(
        'postgres://user:pass@localhost:5432/gototalk?options=x_test',
      ),
    ).toThrow(/_test/);
  });

  it('[TC-00-04] rejects an invalid URL', () => {
    expect(() => assertTestDatabaseUrl('not a url')).toThrow(/is not valid/);
  });

  it('[TC-00-04] rejects a URL without a database name', () => {
    expect(() =>
      assertTestDatabaseUrl('postgres://user:pass@localhost:5432'),
    ).toThrow(/_test/);
  });

  it('[TC-00-04] does not leak the password in the error', () => {
    let message = '';
    try {
      assertTestDatabaseUrl('postgres://user:hunter2@localhost:5432/gototalk');
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).not.toBe('');
    expect(message).not.toContain('hunter2');
  });
});
