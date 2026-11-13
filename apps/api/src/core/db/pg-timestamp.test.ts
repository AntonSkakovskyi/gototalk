import { describe, expect, it } from 'vitest';
import { pgTimestampToDate } from './pg-timestamp.js';

describe('pgTimestampToDate', () => {
  it('[TC-01-02] parses the Postgres timestamptz text format', () => {
    expect(pgTimestampToDate('2026-11-13 10:00:00+00').toISOString()).toBe(
      '2026-11-13T10:00:00.000Z',
    );
  });

  it('[TC-01-02] keeps fractional seconds and honours the offset', () => {
    expect(pgTimestampToDate('2026-11-13 10:00:00.123456+00').getTime()).toBe(
      Date.parse('2026-11-13T10:00:00.123Z'),
    );
    expect(pgTimestampToDate('2026-11-13 10:00:00.5+02').toISOString()).toBe(
      '2026-11-13T08:00:00.500Z',
    );
  });

  it('[TC-01-02] throws on an unparseable value', () => {
    expect(() => pgTimestampToDate('not a date')).toThrow();
  });
});
