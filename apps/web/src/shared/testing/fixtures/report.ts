import type { SessionReport } from '@gototalk/shared';
import { testSession } from './session';
import { testWord } from './words';

export function testReport(
  overrides: Partial<SessionReport> = {},
): SessionReport {
  return {
    sessionId: testSession().id,
    answers: 5,
    durationSeconds: 372,
    summary: {
      status: 'ready',
      text: 'You answered fluently, but past tenses need more practice.',
    },
    categories: [
      {
        category: 'verb_tense',
        count: 2,
        theoryLinks: [
          {
            id: 'past-simple',
            title: 'Past Simple',
            url: 'https://example.com/theory/past-simple',
          },
        ],
      },
      { category: 'word_order', count: 1, theoryLinks: [] },
    ],
    words: [
      testWord(),
      testWord({
        id: '4a8d3e27-1b5c-4c9d-9e6f-7a2b8c1d0002',
        lemma: 'budget',
        translationUk: 'бюджет',
        state: 'partial',
        source: 'hint',
      }),
    ],
    ...overrides,
  };
}
