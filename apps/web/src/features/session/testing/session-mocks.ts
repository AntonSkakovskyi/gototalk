import {
  PlanSessionRequestSchema,
  type PlanSessionRequest,
  type SessionPlan,
} from '@gototalk/shared';
import { mockApi, type MockRequest } from '@/shared/testing/mock-api';
import { jsonResponse } from '@/shared/testing/http-responses';
import {
  testSessionDetails,
  testSessionPlan,
  testUtterance,
} from '@/shared/testing/fixtures/session';

export const STARTED_SESSION = testSessionDetails({
  id: '7c2e8b64-5f0a-4d1b-8e3a-2a9b4c6d0099',
  utterances: [
    testUtterance({
      id: '9e4a1c73-6b2d-4f8a-a1c5-3b7d5e8f0099',
      text: 'Which part of the offsite are you most excited about?',
    }),
  ],
});

type Reply = Response | Promise<Response>;

export function planFor({
  previousTopics,
  customTopic,
}: PlanSessionRequest): SessionPlan {
  if (customTopic !== undefined) {
    return testSessionPlan({ topic: customTopic, topicSource: 'custom' });
  }
  return testSessionPlan({ topic: `Topic ${previousTopics.length}` });
}

export const startOk = () => jsonResponse(STARTED_SESSION, 201);

function planRequests(requests: MockRequest[]): PlanSessionRequest[] {
  return requests
    .filter((request) => request.path === '/api/sessions/plan')
    .map((request) => PlanSessionRequestSchema.parse(request.body));
}

function startRequests(requests: MockRequest[]): unknown[] {
  return requests
    .filter((request) => request.path === '/api/sessions')
    .map((request) => request.body);
}

interface SessionApiReplies {
  plan?: (body: PlanSessionRequest) => Reply;
  start?: () => Reply;
}

export function mockSessionApi({
  plan = (body) => jsonResponse(planFor(body)),
  start = startOk,
}: SessionApiReplies = {}) {
  const { requests } = mockApi({
    'POST /api/sessions/plan': (request) =>
      plan(PlanSessionRequestSchema.parse(request.body)),
    'POST /api/sessions': start,
  });
  return {
    requests,
    planRequests: () => planRequests(requests),
    startRequests: () => startRequests(requests),
  };
}
