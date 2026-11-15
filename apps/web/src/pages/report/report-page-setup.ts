import { mockApi } from '@/shared/testing/mock-api';
import { reportOk } from '@/shared/testing/report-mocks';
import { TEST_PROFILE } from '@/shared/testing/fixtures/profile';
import { TEST_USER } from '@/shared/testing/fixtures/auth';
import { jsonResponse } from '@/shared/testing/http-responses';
import {
  testSessionDetails,
  testTurnResult,
  testUtterance,
} from '@/shared/testing/fixtures/session';
import { testWord } from '@/shared/testing/fixtures/words';

export const AUTH = {
  accessToken: 'access-1',
  user: { ...TEST_USER, consentAt: '2026-01-01T10:00:00.000Z' },
};
export const TURN = testTurnResult();
const FIRST_QUESTION = testUtterance();
const SECOND_QUESTION = TURN.reply ?? testUtterance();
export const FINISHED = testSessionDetails({
  status: 'finished',
  feedbackMode: 'deferred',
  endedAt: '2026-11-13T10:07:20.000Z',
  planRemaining: 3,
  utterances: [FIRST_QUESTION, TURN.utterance, SECOND_QUESTION],
});
export const ROUTE = `/sessions/${FINISHED.id}/report`;
export const DETAILS_ROUTE = `GET /api/sessions/${FINISHED.id}`;
export const REPORT_ROUTE = `${DETAILS_ROUTE}/report`;

type Reply = Response | (() => Response | Promise<Response>);

export function mockReportPage(reply: Reply, report: Reply = reportOk) {
  const { requests } = mockApi({
    'GET /api/profile': jsonResponse(TEST_PROFILE),
    [DETAILS_ROUTE]: reply,
    [REPORT_ROUTE]: report,
    [`PATCH /api/words/${testWord().id}`]: () =>
      jsonResponse(testWord({ state: 'passive' })),
  });
  return { requests };
}
