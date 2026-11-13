import { QueryClient } from '@tanstack/react-query';
import { authResponse, emptyResponse } from '@/shared/testing/test-fixtures';
import { logout } from '@/auth/auth-api';
import { clearQueryCacheOnSessionEnd } from './query-cache';
import { clearSession, setSession } from './session-store';

describe('clearQueryCacheOnSessionEnd', () => {
  let queryClient: QueryClient;
  let unbind: () => void;

  beforeEach(() => {
    queryClient = new QueryClient();
    queryClient.setQueryData(['words'], [{ id: 1 }]);
    unbind = clearQueryCacheOnSessionEnd(queryClient);
  });

  afterEach(() => {
    unbind();
    vi.unstubAllGlobals();
  });

  it('[TC-01-03] clears the query cache when the session is cleared', () => {
    setSession(authResponse());
    clearSession();

    expect(queryClient.getQueryData(['words'])).toBeUndefined();
  });

  it('[TC-01-03] logout clears the session and the query cache', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(emptyResponse()));
    setSession(authResponse());

    await logout();

    expect(queryClient.getQueryData(['words'])).toBeUndefined();
  });

  it('[TC-01-03] stops clearing after unbind', () => {
    unbind();

    clearSession();

    expect(queryClient.getQueryData(['words'])).toEqual([{ id: 1 }]);
  });
});
