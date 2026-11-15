import type { Profile } from '@gototalk/shared';
import { renderHook, waitFor } from '@testing-library/react';
import { mockApi } from '@/shared/testing/mock-api';
import {
  createQueryWrapper,
  createTestQueryClient,
} from '@/shared/testing/query-wrapper';
import { TEST_PROFILE } from '@/shared/testing/fixtures/profile';
import { errorResponse, jsonResponse } from '@/shared/testing/http-responses';
import { profileKeys } from '@/features/profile/api/profile-queries';
import { useUpdateProfile } from './use-update-profile';

describe('useUpdateProfile', () => {
  it('[TC-02-02] stores the saved profile in the cache', async () => {
    const saved: Profile = { ...TEST_PROFILE, level: 'C1' };
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(profileKeys.profile(), TEST_PROFILE);
    const { requests } = mockApi({ 'PUT /api/profile': jsonResponse(saved) });
    const { result } = renderHook(() => useUpdateProfile(), {
      wrapper: createQueryWrapper(queryClient),
    });

    result.current.mutate({ level: 'C1', scenes: saved.scenes });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requests[0]?.body).toEqual({ level: 'C1', scenes: saved.scenes });
    expect(queryClient.getQueryData(profileKeys.profile())).toEqual(saved);
  });

  it('[TC-02-02] keeps the cached profile when saving fails', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(profileKeys.profile(), TEST_PROFILE);
    mockApi({ 'PUT /api/profile': errorResponse(400, 'VALIDATION_ERROR') });
    const { result } = renderHook(() => useUpdateProfile(), {
      wrapper: createQueryWrapper(queryClient),
    });

    result.current.mutate({ level: 'C1', scenes: TEST_PROFILE.scenes });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient.getQueryData(profileKeys.profile())).toEqual(
      TEST_PROFILE,
    );
  });
});
