import type { Word } from '@gototalk/shared';

export function testWord(overrides: Partial<Word> = {}): Word {
  return {
    id: '4a8d3e27-1b5c-4c9d-9e6f-7a2b8c1d0001',
    lemma: 'schedule',
    translationUk: 'розклад',
    state: 'new',
    source: 'session',
    ...overrides,
  };
}
