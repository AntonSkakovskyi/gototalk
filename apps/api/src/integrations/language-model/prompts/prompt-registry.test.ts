import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadPrompt } from './load-prompt.js';
import { PROMPT_IDS } from './prompt-registry.js';

const require = createRequire(import.meta.url);

const promptDir = dirname(
  require.resolve(`@gototalk/prompts/${PROMPT_IDS[0]}.md`),
);

const PROMPT_FILE = /^(.+\.v\d+)\.md$/;

describe('prompt registry', () => {
  it('resolves and loads every registered prompt id', () => {
    expect(PROMPT_IDS.length).toBeGreaterThan(0);
    for (const id of PROMPT_IDS) {
      expect(readdirSync(promptDir)).toContain(`${id}.md`);
      expect(loadPrompt(id).length).toBeGreaterThan(0);
    }
  });

  it('registers every prompt file of the prompts package', () => {
    const fileIds = readdirSync(promptDir)
      .map((name) => PROMPT_FILE.exec(name)?.[1])
      .filter((id): id is string => id !== undefined);

    expect([...fileIds].sort()).toEqual([...PROMPT_IDS].sort());
  });

  it('keeps exactly one input placeholder in every template', () => {
    for (const id of PROMPT_IDS) {
      expect(loadPrompt(id).split('{{input}}')).toHaveLength(2);
    }
  });
});
