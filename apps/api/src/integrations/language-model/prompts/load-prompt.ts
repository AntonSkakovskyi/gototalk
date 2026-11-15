import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const PROMPT_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*\.v\d+$/;
const cache = new Map<string, string>();

export function loadPrompt(id: string): string {
  if (!PROMPT_ID.test(id)) {
    throw new Error('Invalid prompt id');
  }
  const cached = cache.get(id);
  if (cached !== undefined) return cached;

  let path: string;
  try {
    path = require.resolve(`@gototalk/prompts/${id}.md`);
  } catch (error) {
    throw new Error(`Prompt "${id}" not found`, { cause: error });
  }
  const text = readFileSync(path, 'utf8');
  cache.set(id, text);
  return text;
}
