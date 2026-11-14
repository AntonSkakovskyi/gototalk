import { FUNCTION_WORDS } from './function-words.js';
import { tokenize } from './word-usage.js';

const NUMERIC = /^\p{N}+$/u;

export function sessionWordCandidates(
  better: { original: string; better: string }[],
): string[] {
  const candidates = new Set<string>();
  for (const pair of better) {
    const known = new Set(tokenize(pair.original));
    for (const token of tokenize(pair.better)) {
      if (known.has(token) || FUNCTION_WORDS.has(token)) continue;
      if (NUMERIC.test(token)) continue;
      candidates.add(token);
    }
  }
  return [...candidates];
}
