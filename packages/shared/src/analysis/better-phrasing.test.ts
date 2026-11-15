import { describe, expect, it } from 'vitest';
import { BetterPhrasingSchema } from './better-phrasing.js';

describe('BetterPhrasingSchema', () => {
  it('[TC-04-01] BetterPhrasingSchema accepts 200 characters and rejects 201 in each field', () => {
    const better = { original: 'a'.repeat(200), better: 'b'.repeat(200) };
    expect(BetterPhrasingSchema.safeParse(better).success).toBe(true);
    expect(
      BetterPhrasingSchema.safeParse({ ...better, original: 'a'.repeat(201) })
        .success,
    ).toBe(false);
    expect(
      BetterPhrasingSchema.safeParse({ ...better, better: 'b'.repeat(201) })
        .success,
    ).toBe(false);
  });
});
