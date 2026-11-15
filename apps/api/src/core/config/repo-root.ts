import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT_MARKER = 'pnpm-workspace.yaml';

export function findRepoRoot(startDir: string): string | undefined {
  let current = path.resolve(startDir);
  for (;;) {
    if (existsSync(path.join(current, ROOT_MARKER))) return current;
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

export function isInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  const escapes =
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative);
  return !escapes;
}
