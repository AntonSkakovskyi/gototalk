import { ERROR_CODES, type PlanSessionRequest } from '@gototalk/shared';
import { mockApi } from '@/shared/testing/mock-api';
import {
  errorResponse,
  jsonResponse,
  testSession,
  testSessionDetails,
  testSessionPlan,
} from '@/shared/testing/test-fixtures';
import {
  listHistory,
  listSessions,
  planSession,
  startSession,
} from './session-api';

describe('session api', () => {
  it('[TC-03-03] planSession posts the request and returns the parsed plan', async () => {
    const plan = testSessionPlan();
    const { requests } = mockApi({
      'POST /api/sessions/plan': jsonResponse(plan),
    });
    const request: PlanSessionRequest = { previousTopics: ['Travel'] };

    await expect(planSession(request)).resolves.toEqual(plan);

    expect(requests[0]?.body).toEqual(request);
  });

  it('[TC-03-03] planSession surfaces CONSENT_REQUIRED', async () => {
    mockApi({
      'POST /api/sessions/plan': errorResponse(
        403,
        ERROR_CODES.CONSENT_REQUIRED,
      ),
    });

    await expect(planSession({ previousTopics: [] })).rejects.toMatchObject({
      status: 403,
      code: ERROR_CODES.CONSENT_REQUIRED,
    });
  });

  it('[TC-03-03] planSession rejects a response that breaks the contract', async () => {
    mockApi({
      'POST /api/sessions/plan': jsonResponse({ topic: 'Only a topic' }),
    });

    await expect(planSession({ previousTopics: [] })).rejects.toThrow();
  });

  it('[TC-03-03] startSession posts the shown plan and returns the details', async () => {
    const details = testSessionDetails();
    const { requests } = mockApi({
      'POST /api/sessions': jsonResponse(details, 201),
    });
    const request = {
      ...testSessionPlan(),
      feedbackMode: 'deferred' as const,
    };

    await expect(startSession(request)).resolves.toEqual(details);

    expect(requests[0]?.body).toEqual(request);
  });

  it('[TC-03-03] listSessions returns the parsed sessions', async () => {
    const sessions = [testSession(), testSession({ status: 'finished' })];
    mockApi({ 'GET /api/sessions': jsonResponse(sessions) });

    await expect(listSessions()).resolves.toEqual(sessions);
  });

  it('[TC-05-03] listHistory requests the first page without a query string', async () => {
    const page = { items: [testSession()], nextCursor: 'c1' };
    const { requests } = mockApi({
      'GET /api/sessions/history': jsonResponse(page),
    });

    await expect(listHistory()).resolves.toEqual(page);

    expect(requests.map((request) => request.path)).toEqual([
      '/api/sessions/history',
    ]);
  });

  it('[TC-05-03] listHistory sends only the defined params, URL-encoded', async () => {
    const { requests } = mockApi({
      'GET /api/sessions/history?cursor=a%2Bb%3D%26c&limit=5': jsonResponse({
        items: [],
        nextCursor: null,
      }),
    });

    await listHistory({ cursor: 'a+b=&c', limit: 5 });

    expect(requests).toHaveLength(1);
  });

  it('[TC-05-03] listHistory omits an undefined cursor', async () => {
    const { requests } = mockApi({
      'GET /api/sessions/history?limit=3': jsonResponse({
        items: [],
        nextCursor: null,
      }),
    });

    await listHistory({ cursor: undefined, limit: 3 });

    expect(requests).toHaveLength(1);
  });

  it('[TC-05-03] listHistory rejects a response that breaks the contract', async () => {
    mockApi({
      'GET /api/sessions/history': jsonResponse([testSession()]),
    });

    await expect(listHistory()).rejects.toThrow();
  });
});
