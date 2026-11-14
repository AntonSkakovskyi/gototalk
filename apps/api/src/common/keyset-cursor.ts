import { z } from 'zod';
import { RequestValidationError } from './zod-body.pipe.js';

// Matches the text Postgres renders for timestamptz, microseconds included
const PG_TIMESTAMPTZ =
  /^([1-9][0-9]{3})-(0[1-9]|1[0-2])-([0-9]{2}) ([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])(\.[0-9]{1,6})?[+-](0[0-9]|1[0-5])(:[0-5][0-9])?$/;

function isRealDate(value: string): boolean {
  const match = PG_TIMESTAMPTZ.exec(value);
  if (!match) return false;
  const [year, month, day] = [match[1], match[2], match[3]].map(Number) as [
    number,
    number,
    number,
  ];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** t is the raw Postgres text of the sort timestamp: a JS Date would truncate microseconds. */
export const KeysetPositionSchema = z.object({
  t: z.string().refine(isRealDate),
  id: z.uuid(),
});

export type KeysetPosition = z.infer<typeof KeysetPositionSchema>;

export function encodeCursor(position: KeysetPosition): string {
  const { t, id } = position;
  return Buffer.from(JSON.stringify({ t, id })).toString('base64url');
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function decodeCursor(cursor: string): KeysetPosition {
  const text = Buffer.from(cursor, 'base64url').toString('utf8');
  const result = KeysetPositionSchema.safeParse(parseJson(text));
  if (!result.success) {
    throw new RequestValidationError([
      {
        code: 'custom',
        path: ['cursor'],
        message: 'Invalid cursor',
        input: undefined,
      },
    ]);
  }
  return result.data;
}
