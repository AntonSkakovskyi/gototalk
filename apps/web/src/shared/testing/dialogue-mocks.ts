import {
  AnswerTextRequestSchema,
  MarkMistakeRequestSchema,
  type AnswerTextRequest,
} from '@gototalk/shared';
import { mockApi, type MockRequest } from './mock-api';
import {
  jsonResponse,
  testMistake,
  testSession,
  testTurnResult,
} from './test-fixtures';

type Reply = Response | Promise<Response>;

export const DIALOGUE_SESSION_ID = testSession().id;
const SESSION_PATH = `/api/sessions/${DIALOGUE_SESSION_ID}`;

export const answerCreated = () =>
  jsonResponse(testTurnResult().utterance, 201);
export const analysisOk = () => jsonResponse(testTurnResult(), 201);
export const markMistakeOk = () => jsonResponse(testMistake({ isFalse: true }));
export const finishOk = () =>
  jsonResponse(
    testSession({ status: 'finished', endedAt: '2026-11-13T10:30:00.000Z' }),
  );

function bodiesOf(requests: MockRequest[], method: string, suffix: string) {
  return requests
    .filter(
      (request) => request.method === method && request.path.endsWith(suffix),
    )
    .map((request) => request.body);
}

interface DialogueApiReplies {
  answer?: (body: AnswerTextRequest) => Reply;
  analyze?: () => Reply;
  markMistake?: () => Reply;
  finish?: () => Reply;
}

/** Routes are keyed by the fixture ids of testTurnResult and testMistake in the test session. */
export function mockDialogueApi({
  answer = answerCreated,
  analyze = analysisOk,
  markMistake = markMistakeOk,
  finish = finishOk,
}: DialogueApiReplies = {}) {
  const turn = testTurnResult();
  const { requests } = mockApi({
    [`POST ${SESSION_PATH}/utterances`]: (request) =>
      answer(AnswerTextRequestSchema.parse(request.body)),
    [`POST ${SESSION_PATH}/utterances/${turn.utterance.id}/analysis`]: analyze,
    [`PATCH ${SESSION_PATH}/mistakes/${testMistake().id}`]: (request) => {
      MarkMistakeRequestSchema.parse(request.body);
      return markMistake();
    },
    [`POST ${SESSION_PATH}/finish`]: finish,
  });
  return {
    requests,
    answerRequests: () => bodiesOf(requests, 'POST', '/utterances'),
    markMistakeRequests: () => bodiesOf(requests, 'PATCH', testMistake().id),
    finishRequests: () => bodiesOf(requests, 'POST', '/finish'),
  };
}
