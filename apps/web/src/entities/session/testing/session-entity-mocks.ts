import { MarkMistakeRequestSchema } from '@gototalk/shared';
import { mockApi, type MockRequest } from '@/shared/testing/mock-api';
import { jsonResponse } from '@/shared/testing/http-responses';
import { testMistake, testSession } from '@/shared/testing/fixtures/session';

type Reply = Response | Promise<Response>;

export const DIALOGUE_SESSION_ID = testSession().id;
export const SESSION_PATH = `/api/sessions/${DIALOGUE_SESSION_ID}`;

export const markMistakeOk = () => jsonResponse(testMistake({ isFalse: true }));

interface SessionEntityApiReplies {
  details?: () => Reply;
  markMistake?: () => Reply;
}

export function sessionEntityRoutes({
  details,
  markMistake = markMistakeOk,
}: SessionEntityApiReplies = {}) {
  return {
    ...(details === undefined ? {} : { [`GET ${SESSION_PATH}`]: details }),
    [`PATCH ${SESSION_PATH}/mistakes/${testMistake().id}`]: (
      request: MockRequest,
    ) => {
      MarkMistakeRequestSchema.parse(request.body);
      return markMistake();
    },
  };
}

export function markMistakeBodies(requests: MockRequest[]): unknown[] {
  return requests
    .filter(
      (request) =>
        request.method === 'PATCH' && request.path.endsWith(testMistake().id),
    )
    .map((request) => request.body);
}

export function mockSessionEntityApi(replies: SessionEntityApiReplies = {}) {
  const { requests } = mockApi(sessionEntityRoutes(replies));
  return {
    requests,
    markMistakeRequests: () => markMistakeBodies(requests),
  };
}
