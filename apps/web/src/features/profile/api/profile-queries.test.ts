import { QueryClient } from '@tanstack/react-query';
import { ERROR_CODES } from '@gototalk/shared';
import { mockApi } from '@/shared/testing/mock-api';
import {
  TEST_PROFILE,
  errorResponse,
  jsonResponse,
} from '@/shared/testing/test-fixtures';
import { profileKeys, profileQueryOptions } from './profile-queries';

afterEach(() => {
  vi.unstubAllGlobals();
});

function fetchProfileWith(...responses: Response[]) {
  const queue = [...responses];
  const { requests } = mockApi({
    'GET /api/profile': () =>
      queue.shift() ?? errorResponse(500, 'RESPONSES_EXHAUSTED'),
  });
  const result = new QueryClient().query({
    ...profileQueryOptions(),
    retryDelay: 0,
  });
  return { requests, result };
}

describe('profile queries', () => {
  it('[TC-02-02] keys are nested under the profile root', () => {
    expect(profileKeys.profile()).toEqual(['profile', 'profile']);
    expect(profileKeys.goals()).toEqual(['profile', 'goals']);
    expect(profileKeys.learnerModel()).toEqual(['profile', 'learner-model']);
  });

  it('[TC-02-02] profile query does not retry a 404', async () => {
    const { requests, result } = fetchProfileWith(
      errorResponse(404, ERROR_CODES.PROFILE_NOT_FOUND),
    );

    await expect(result).rejects.toMatchObject({ status: 404 });

    expect(requests).toHaveLength(1);
  });

  it('[TC-02-02] profile query does not retry any other 4xx', async () => {
    const { requests, result } = fetchProfileWith(
      errorResponse(403, ERROR_CODES.CONSENT_REQUIRED),
    );

    await expect(result).rejects.toMatchObject({ status: 403 });

    expect(requests).toHaveLength(1);
  });

  it('[TC-02-02] profile query retries a server error once', async () => {
    const { requests, result } = fetchProfileWith(
      errorResponse(503, 'UNAVAILABLE'),
      jsonResponse(TEST_PROFILE),
    );

    await expect(result).resolves.toEqual(TEST_PROFILE);

    expect(requests).toHaveLength(2);
  });
});
