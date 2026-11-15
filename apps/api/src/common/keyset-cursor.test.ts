import { describe, expect, it } from 'vitest';
import { RequestValidationError } from './zod-body.pipe.js';
import { decodeCursor, encodeCursor } from './keyset-cursor.js';

const ID = '6f1c2a0e-4b8d-4f7e-9a53-0c7d2f1b9e11';

function encodeRaw(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

describe('keyset cursor', () => {
  it('[TC-05-03] round-trips the position with microsecond precision', () => {
    const position = { t: '2026-11-13 10:00:00.123456+00', id: ID };

    expect(decodeCursor(encodeCursor(position))).toEqual(position);
  });

  it('[TC-05-03] encodes to URL-safe characters only', () => {
    const cursor = encodeCursor({ t: '2026-11-13 10:00:00+05:30', id: ID });

    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('[TC-05-03] accepts timestamps without fraction and with a minute offset', () => {
    for (const t of ['2026-11-13 10:00:00+00', '2026-11-13 10:00:00.5-03:30']) {
      expect(decodeCursor(encodeCursor({ t, id: ID })).t).toBe(t);
    }
  });

  it.each([
    ['garbage', 'not-a-cursor'],
    ['empty', ''],
    ['non-object json', encodeRaw('text')],
    ['null json', encodeRaw(null)],
    ['missing id', encodeRaw({ t: '2026-11-13 10:00:00+00' })],
    ['missing t', encodeRaw({ id: ID })],
    ['bad id', encodeRaw({ t: '2026-11-13 10:00:00+00', id: 'nope' })],
    ['non-string t', encodeRaw({ t: 5, id: ID })],
    ['empty t', encodeRaw({ t: '', id: ID })],
    ['unparseable t', encodeRaw({ t: 'yesterday', id: ID })],
    ['iso t with T', encodeRaw({ t: '2026-11-13T10:00:00Z', id: ID })],
    ['impossible month', encodeRaw({ t: '2026-13-01 10:00:00+00', id: ID })],
    ['impossible day', encodeRaw({ t: '2026-02-31 10:00:00+00', id: ID })],
    ['sql in t', encodeRaw({ t: "2026-11-13 10:00:00+00'; --", id: ID })],
  ])(
    '[TC-05-03] rejects a %s cursor with RequestValidationError',
    (_, cursor) => {
      expect(() => decodeCursor(cursor)).toThrow(RequestValidationError);
    },
  );

  it('[TC-05-03] the error reports the cursor path without echoing its value', () => {
    let caught: unknown;
    try {
      decodeCursor(encodeRaw({ t: 'secret-value', id: ID }));
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(RequestValidationError);
    if (!(caught instanceof RequestValidationError)) return;
    expect(caught.issues.map((issue) => issue.path)).toEqual([['cursor']]);
    expect(JSON.stringify(caught.issues)).not.toContain('secret-value');
  });
});
