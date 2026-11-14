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

function audioOf(form: FormData): File {
  const audio = form.get('audio');
  if (!(audio instanceof File)) {
    throw new Error('The multipart body has no audio file');
  }
  return audio;
}

function bodiesOf(requests: MockRequest[], method: string, suffix: string) {
  return requests
    .filter(
      (request) => request.method === method && request.path.endsWith(suffix),
    )
    .map((request) => request.body);
}

interface DialogueApiReplies {
  details?: () => Reply;
  answer?: (body: AnswerTextRequest) => Reply;
  voiceAnswer?: (audio: File) => Reply;
  analyze?: () => Reply;
  markMistake?: () => Reply;
  finish?: () => Reply;
}

/** Routes are keyed by the fixture ids of testTurnResult and testMistake in the test session. */
export function mockDialogueApi({
  details,
  answer = answerCreated,
  voiceAnswer = answerCreated,
  analyze = analysisOk,
  markMistake = markMistakeOk,
  finish = finishOk,
}: DialogueApiReplies = {}) {
  const turn = testTurnResult();
  const { requests } = mockApi({
    ...(details === undefined ? {} : { [`GET ${SESSION_PATH}`]: details }),
    [`POST ${SESSION_PATH}/utterances`]: (request) =>
      request.body instanceof FormData
        ? voiceAnswer(audioOf(request.body))
        : answer(AnswerTextRequestSchema.parse(request.body)),
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
    audioRequests: () =>
      bodiesOf(requests, 'POST', '/utterances').flatMap((body) =>
        body instanceof FormData ? [audioOf(body)] : [],
      ),
    markMistakeRequests: () => bodiesOf(requests, 'PATCH', testMistake().id),
    finishRequests: () => bodiesOf(requests, 'POST', '/finish'),
  };
}
