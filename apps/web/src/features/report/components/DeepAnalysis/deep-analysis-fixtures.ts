import type { SessionDetails } from '@gototalk/shared';
import { screen } from '@testing-library/react';
import uk from '@/shared/i18n/uk.json';
import {
  testMistake,
  testReport,
  testSessionDetails,
  testUtterance,
} from '@/shared/testing/test-fixtures';

export const REPORT = testReport();
export const SESSION_ID = REPORT.sessionId;
export const SESSION_PATH = `/api/sessions/${SESSION_ID}`;
export const OPEN = uk.report.deep.open;

export const QUESTION_1 = testUtterance({
  id: 'q1',
  seq: 1,
  text: 'First question?',
});
export const QUESTION_2 = testUtterance({
  id: 'q2',
  seq: 3,
  text: 'Second question?',
});
export const ANSWER_1 = testUtterance({
  id: 'a1',
  seq: 2,
  role: 'user',
  text: 'I go to the offsite yesterday',
  analysisStatus: 'done',
  mistakes: [testMistake()],
  better: [{ original: 'I go', better: 'I went' }],
});
export const ANSWER_2 = testUtterance({
  id: 'a2',
  seq: 4,
  role: 'user',
  text: 'He go and I very like it',
  analysisStatus: 'done',
  mistakes: [
    testMistake({ id: 'm2', start: 3, end: 5, original: 'go' }),
    testMistake({
      id: 'm3',
      start: 10,
      end: 21,
      original: 'I very like',
      category: 'word_order',
    }),
  ],
  better: [{ original: 'I very like', better: 'I really like' }],
});

export function details(
  overrides: Partial<SessionDetails> = {},
): SessionDetails {
  return testSessionDetails({
    status: 'finished',
    utterances: [QUESTION_1, ANSWER_1, QUESTION_2, ANSWER_2],
    ...overrides,
  });
}

export function groupNamed(
  category: 'verb_tense' | 'word_order',
  count: number,
) {
  return screen.getByRole('region', {
    name: `${uk.mistakeCategories[category]} – ${count}`,
  });
}
