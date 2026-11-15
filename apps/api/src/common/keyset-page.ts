import { sql } from 'drizzle-orm';
import type { AnyColumn, SQL } from 'drizzle-orm';
import { decodeCursor, encodeCursor } from './keyset-cursor.js';
import type { KeysetPosition } from './keyset-cursor.js';

export interface KeysetPage<T> {
  items: T[];
  next: KeysetPosition | null;
}

/** Expects limit + 1 rows: the extra one only proves that another page exists. */
export function toKeysetPage<Row, Item>(
  rows: Row[],
  limit: number,
  position: (row: Row) => KeysetPosition,
  toItem: (row: Row) => Item,
): KeysetPage<Item> {
  const last = rows[limit - 1];
  return {
    items: rows.slice(0, limit).map(toItem),
    next: rows.length > limit && last ? position(last) : null,
  };
}

export function toCursorPage<Item>({ items, next }: KeysetPage<Item>): {
  items: Item[];
  nextCursor: string | null;
} {
  return { items, nextCursor: next === null ? null : encodeCursor(next) };
}

export function afterOf(
  cursor: string | undefined,
): KeysetPosition | undefined {
  return cursor === undefined ? undefined : decodeCursor(cursor);
}

/** The columns must be the descending sort key; the timestamp is compared as raw text to keep microseconds. */
export function olderThan(
  time: AnyColumn,
  id: AnyColumn,
  after: KeysetPosition,
): SQL {
  return sql`(${time}, ${id}) < (${after.t}::timestamptz, ${after.id}::uuid)`;
}
