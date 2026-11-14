import { describe, expect, it } from 'vitest';
import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX, PageQuerySchema } from './index.js';

describe('pagination', () => {
  it('[TC-05-03] PageQuerySchema defaults the limit and keeps the cursor', () => {
    expect(PageQuerySchema.parse({})).toEqual({
      limit: PAGE_SIZE_DEFAULT,
    });
    expect(PageQuerySchema.parse({ cursor: 'abc', limit: '5' })).toEqual({
      cursor: 'abc',
      limit: 5,
    });
    expect(PageQuerySchema.parse({ limit: String(PAGE_SIZE_MAX) }).limit).toBe(
      PAGE_SIZE_MAX,
    );
  });

  it('[TC-05-03] PageQuerySchema rejects a bad limit or cursor', () => {
    const bad = [
      { limit: '0' },
      { limit: String(PAGE_SIZE_MAX + 1) },
      { limit: 'abc' },
      { limit: '' },
      { limit: '1.5' },
      { limit: '-1' },
      { limit: ['1', '2'] },
      { cursor: '' },
      { cursor: 'x'.repeat(201) },
      { cursor: ['a', 'b'] },
    ];
    for (const query of bad) {
      expect(
        PageQuerySchema.safeParse(query).success,
        JSON.stringify(query),
      ).toBe(false);
    }
  });
});
