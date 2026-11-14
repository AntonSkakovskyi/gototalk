import { describe, expect, it } from 'vitest';
import { RequestValidationError } from './zod-body.pipe.js';
import { encodeCursor } from './keyset-cursor.js';
import { afterOf, toCursorPage, toKeysetPage } from './keyset-page.js';

const ID = '6f1c2a0e-4b8d-4f7e-9a53-0c7d2f1b9e11';

interface Row {
  at: string;
  id: string;
}

const rows: Row[] = [
  { at: '2026-01-03 10:00:00.000003+00', id: 'c' },
  { at: '2026-01-02 10:00:00.000002+00', id: 'b' },
  { at: '2026-01-01 10:00:00.000001+00', id: 'a' },
];

const position = (row: Row) => ({ t: row.at, id: row.id });
const label = (row: Row) => row.id;

describe('keyset page', () => {
  it('[TC-05-05] trims the probe row and points the cursor at the last returned row', () => {
    expect(toKeysetPage(rows, 2, position, label)).toEqual({
      items: ['c', 'b'],
      next: { t: rows[1]?.at, id: 'b' },
    });
  });

  it('[TC-05-05] has no next position when the rows fit the limit', () => {
    expect(toKeysetPage(rows.slice(0, 2), 2, position, label)).toEqual({
      items: ['c', 'b'],
      next: null,
    });
    expect(toKeysetPage([], 2, position, label)).toEqual({
      items: [],
      next: null,
    });
  });

  it('[TC-05-05] encodes the next position into an opaque cursor', () => {
    const page = toCursorPage(toKeysetPage(rows, 1, position, label));

    expect(page.items).toEqual(['c']);
    expect(page.nextCursor).toBe(encodeCursor({ t: rows[0]!.at, id: 'c' }));
    expect(toCursorPage({ items: [], next: null })).toEqual({
      items: [],
      nextCursor: null,
    });
  });

  it('[TC-05-05] decodes an optional cursor and rejects a bad one', () => {
    const next = { t: '2026-01-01 10:00:00.5+00', id: ID };

    expect(afterOf(undefined)).toBeUndefined();
    expect(afterOf(encodeCursor(next))).toEqual(next);
    expect(() => afterOf('garbage')).toThrow(RequestValidationError);
  });
});
