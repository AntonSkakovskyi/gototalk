import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findRepoRoot, isInside } from './repo-root.js';

describe('findRepoRoot', () => {
  let base: string;

  beforeEach(() => {
    base = mkdtempSync(path.join(tmpdir(), 'gototalk-root-'));
  });

  afterEach(() => {
    rmSync(base, { recursive: true, force: true });
  });

  it('returns the start directory when it holds pnpm-workspace.yaml', () => {
    writeFileSync(path.join(base, 'pnpm-workspace.yaml'), 'packages: []\n');

    expect(findRepoRoot(base)).toBe(base);
  });

  it('walks up to the nearest ancestor with pnpm-workspace.yaml', () => {
    writeFileSync(path.join(base, 'pnpm-workspace.yaml'), 'packages: []\n');
    const nested = path.join(base, 'apps', 'api');
    mkdirSync(nested, { recursive: true });

    expect(findRepoRoot(nested)).toBe(base);
  });

  it('prefers the nearest marker over a farther one', () => {
    writeFileSync(path.join(base, 'pnpm-workspace.yaml'), 'packages: []\n');
    const inner = path.join(base, 'inner');
    mkdirSync(inner);
    writeFileSync(path.join(inner, 'pnpm-workspace.yaml'), 'packages: []\n');

    expect(findRepoRoot(inner)).toBe(inner);
  });

  it('returns undefined when no ancestor has the marker', () => {
    const nested = path.join(base, 'a', 'b');
    mkdirSync(nested, { recursive: true });

    expect(findRepoRoot(nested)).toBeUndefined();
  });
});

describe('isInside', () => {
  const parent = path.resolve(path.sep, 'repo');

  it('counts the same directory as inside', () => {
    expect(isInside(parent, parent)).toBe(true);
  });

  it('counts nested paths as inside', () => {
    expect(isInside(parent, path.join(parent, 'tmp', 'audio'))).toBe(true);
  });

  it('does not count a sibling sharing the name prefix as inside', () => {
    expect(isInside(parent, `${parent}-other`)).toBe(false);
  });

  it('does not count a parent or an unrelated directory as inside', () => {
    expect(isInside(parent, path.dirname(parent))).toBe(false);
    expect(isInside(parent, path.resolve(path.sep, 'elsewhere'))).toBe(false);
  });

  it('treats dot segments as the directory they resolve to', () => {
    expect(isInside(parent, path.join(parent, 'a', '..', '..', 'repo'))).toBe(
      true,
    );
    expect(isInside(parent, path.join(parent, '..', 'repo-other'))).toBe(false);
  });
});
