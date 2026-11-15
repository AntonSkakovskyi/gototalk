import {
  AnswerTextRequestSchema,
  HintRequestSchema,
  type AnswerTextRequest,
  type HintRequest,
} from '@gototalk/shared';
import {
  SESSION_PATH,
  markMistakeBodies,
  markMistakeOk,
  sessionEntityRoutes,
} from '@/entities/session/testing/session-entity-mocks';
import { mockApi, type MockRequest } from '@/shared/testing/mock-api';
import { jsonResponse } from '@/shared/testing/http-responses';
import { testSession, testTurnResult } from '@/shared/testing/fixtures/session';

type Reply = Response | Promise<Response>;

export const answerCreated = () =>
  jsonResponse(testTurnResult().utterance, 201);
export const analysisOk = () => jsonResponse(testTurnResult(), 201);
export const HINT_PHRASE = 'In my opinion, the best way is to';
export const HINT_TRANSLATION = 'meeting';
export const hintOk = (request: HintRequest) =>
  jsonResponse(
    request.kind === 'phrase_start'
      ? { kind: 'phrase_start', text: HINT_PHRASE }
      : { kind: 'translation', word: HINT_TRANSLATION },
  );
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
  hint?: (body: HintRequest) => Reply;
  finish?: () => Reply;
}

/** Routes are keyed by the fixture ids of testTurnResult and testMistake in the test session. */
export function mockDialogueApi({
  details,
  answer = answerCreated,
  voiceAnswer = answerCreated,
  analyze = analysisOk,
  markMistake = markMistakeOk,
  hint = hintOk,
  finish = finishOk,
}: DialogueApiReplies = {}) {
  const turn = testTurnResult();
  const { requests } = mockApi({
    ...sessionEntityRoutes({ details, markMistake }),
    [`POST ${SESSION_PATH}/utterances`]: (request) =>
      request.body instanceof FormData
        ? voiceAnswer(audioOf(request.body))
        : answer(AnswerTextRequestSchema.parse(request.body)),
    [`POST ${SESSION_PATH}/utterances/${turn.utterance.id}/analysis`]: analyze,
    [`POST ${SESSION_PATH}/hints`]: (request) =>
      hint(HintRequestSchema.parse(request.body)),
    [`POST ${SESSION_PATH}/finish`]: finish,
  });
  return {
    requests,
    answerRequests: () => bodiesOf(requests, 'POST', '/utterances'),
    audioRequests: () =>
      bodiesOf(requests, 'POST', '/utterances').flatMap((body) =>
        body instanceof FormData ? [audioOf(body)] : [],
      ),
    markMistakeRequests: () => markMistakeBodies(requests),
    hintRequests: () => bodiesOf(requests, 'POST', '/hints'),
    finishRequests: () => bodiesOf(requests, 'POST', '/finish'),
  };
}
