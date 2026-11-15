import { describe, expect, it, vi } from 'vitest';
import { loadPrompt } from './load-prompt.js';

const reads = vi.hoisted(() => ({ count: 0 }));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    readFileSync: ((...args: Parameters<typeof actual.readFileSync>) => {
      reads.count += 1;
      return actual.readFileSync(...args);
    }) as typeof actual.readFileSync,
  };
});

describe('loadPrompt', () => {
  it('[TC-03-04] finds the versioned prompt file by id', () => {
    const text = loadPrompt('session-plan.v1');

    expect(text).toContain('{{input}}');
    expect(text.length).toBeGreaterThan(200);
  });

  it('[TC-03-04] reads the file once and serves later calls from the cache', () => {
    loadPrompt('session-plan.v1');
    const readsAfterFirst = reads.count;

    loadPrompt('session-plan.v1');

    expect(reads.count).toBe(readsAfterFirst);
  });

  it('[TC-03-04] rejects an unknown id with an error naming only the id', () => {
    expect(() => loadPrompt('no-such-prompt.v9')).toThrow(
      'Prompt "no-such-prompt.v9" not found',
    );
  });

  it.each(['../package.json', '../x.v1', 'UPPER.v1', 'session-plan.v1.md'])(
    '[TC-03-04] rejects the invalid id %s',
    (id) => {
      expect(() => loadPrompt(id)).toThrow('Invalid prompt id');
    },
  );

  it('[TC-03-04] keeps the resolve failure as the cause of the not-found error', () => {
    expect.assertions(1);
    try {
      loadPrompt('no-such-prompt.v9');
    } catch (error) {
      expect(error).toHaveProperty('cause', expect.any(Error));
    }
  });
});
