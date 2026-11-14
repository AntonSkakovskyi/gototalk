import { ERROR_CODES } from '@gototalk/shared';
import { QueryClient } from '@tanstack/react-query';
import { mockApi } from '@/shared/testing/mock-api';
import {
  errorResponse,
  jsonResponse,
  testSessionDetails,
} from '@/shared/testing/test-fixtures';
import {
  getSession,
  sessionDetailsQueryOptions,
  sessionKeys,
} from './session-details';

describe('session details', () => {
  it('[TC-03-03] keys are nested under the session root', () => {
    expect(sessionKeys.list()).toEqual(['session', 'list']);
    expect(sessionKeys.details('abc')).toEqual(['session', 'details', 'abc']);
  });

  it('[TC-03-03] plan keys differ per request', () => {
    const first = sessionKeys.plan({ previousTopics: [] });
    const second = sessionKeys.plan({ previousTopics: ['Travel'] });

    expect(first).not.toEqual(second);
    expect(first.slice(0, 2)).toEqual(['session', 'plan']);
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

  it('[TC-03-03] seeded details are served from the cache without a request', async () => {
    const details = testSessionDetails();
    const { requests } = mockApi({});
    const queryClient = new QueryClient();
    queryClient.setQueryData(sessionKeys.details(details.id), details);

    await expect(
      queryClient.query(sessionDetailsQueryOptions(details.id)),
    ).resolves.toEqual(details);

    expect(requests).toHaveLength(0);
  });

  it('[TC-03-03] details fetched on a direct visit are requested once', async () => {
    const details = testSessionDetails();
    const { requests } = mockApi({
      [`GET /api/sessions/${details.id}`]: jsonResponse(details),
    });

    await expect(
      new QueryClient().query(sessionDetailsQueryOptions(details.id)),
    ).resolves.toEqual(details);

    expect(requests).toHaveLength(1);
  });

  it('[TC-03-03] details query does not retry a missing session', async () => {
    const { requests } = mockApi({
      'GET /api/sessions/abc': errorResponse(
        404,
        ERROR_CODES.SESSION_NOT_FOUND,
      ),
    });

    await expect(
      new QueryClient().query({
        ...sessionDetailsQueryOptions('abc'),
        retryDelay: 0,
      }),
    ).rejects.toMatchObject({ status: 404 });

    expect(requests).toHaveLength(1);
  });
});
