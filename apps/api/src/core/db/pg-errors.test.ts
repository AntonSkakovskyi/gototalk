import { describe, expect, it } from 'vitest';
import { isForeignKeyViolation, isUniqueViolation } from './pg-errors.js';

function pgError(code: string): Error {
  return Object.assign(new Error('driver error'), { code });
}

function wrap(cause: unknown): Error {
  return new Error('Failed query', { cause });
}

describe.each([
  ['isUniqueViolation', isUniqueViolation, '23505'],
  ['isForeignKeyViolation', isForeignKeyViolation, '23503'],
])('%s', (_name, predicate, code) => {
  it('[TC-02-02] matches a direct driver error', () => {
    expect(predicate(pgError(code))).toBe(true);
  });

  it('[TC-02-02] matches a driver error wrapped in cause', () => {
    expect(predicate(wrap(pgError(code)))).toBe(true);
  });

  it('[TC-02-02] matches a driver error nested several causes deep', () => {
    expect(predicate(wrap(wrap(wrap(pgError(code)))))).toBe(true);
  });

  it('[TC-02-02] rejects an unrelated error code', () => {
    expect(predicate(pgError('42P01'))).toBe(false);
    expect(predicate(wrap(pgError('42P01')))).toBe(false);
  });

  it('[TC-02-02] rejects an error without a code', () => {
    expect(predicate(new Error('plain'))).toBe(false);
  });

  it('[TC-02-02] rejects non-error input', () => {
    expect(predicate(undefined)).toBe(false);
    expect(predicate(null)).toBe(false);
    expect(predicate('23505')).toBe(false);
    expect(predicate({ code })).toBe(false);
  });
});

describe('pg error predicates', () => {
  it('[TC-02-02] distinguish unique from foreign key violations', () => {
    expect(isUniqueViolation(pgError('23503'))).toBe(false);
    expect(isForeignKeyViolation(pgError('23505'))).toBe(false);
  });
});
