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
  getSession,
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

  it('[TC-03-03] getSession reads the details by id', async () => {
    const details = testSessionDetails();
    mockApi({ [`GET /api/sessions/${details.id}`]: jsonResponse(details) });

    await expect(getSession(details.id)).resolves.toEqual(details);
  });

  it('[TC-03-03] getSession surfaces SESSION_NOT_FOUND', async () => {
    mockApi({
      'GET /api/sessions/missing': errorResponse(
        404,
        ERROR_CODES.SESSION_NOT_FOUND,
      ),
    });

    await expect(getSession('missing')).rejects.toMatchObject({
      status: 404,
      code: ERROR_CODES.SESSION_NOT_FOUND,
    });
  });
});
