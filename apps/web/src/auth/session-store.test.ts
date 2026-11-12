import { act, renderHook } from '@testing-library/react';
import { TEST_USER } from '../test-fixtures.js';
import {
  clearSession,
  getSession,
  onSessionCleared,
  resetSessionStore,
  setSession,
  updateUser,
  useSession,
} from './session-store.js';

describe('session store', () => {
  it('[TC-01-03] starts as unknown without token or user', () => {
    expect(getSession()).toEqual({
      status: 'unknown',
      accessToken: null,
      user: null,
    });
  });

  it('[TC-01-03] setSession makes the session authenticated', () => {
    setSession({ accessToken: 'a', user: TEST_USER });

    expect(getSession()).toEqual({
      status: 'authenticated',
      accessToken: 'a',
      user: TEST_USER,
    });
  });

  it('[TC-01-03] clearSession makes the session anonymous and drops token and user', () => {
    setSession({ accessToken: 'a', user: TEST_USER });
    clearSession();

    expect(getSession()).toEqual({
      status: 'anonymous',
      accessToken: null,
      user: null,
    });
  });

  it('[TC-01-03] updateUser replaces the user and keeps the token', () => {
    setSession({ accessToken: 'a', user: TEST_USER });
    const consented = { ...TEST_USER, consentAt: '2026-11-13T10:00:00.000Z' };
    updateUser(consented);

    expect(getSession()).toEqual({
      status: 'authenticated',
      accessToken: 'a',
      user: consented,
    });
  });

  it('[TC-01-03] updateUser is ignored without an authenticated session', () => {
    updateUser(TEST_USER);

    expect(getSession().user).toBeNull();
  });

  it('[TC-01-03] notifies cleared listeners until they unsubscribe', () => {
    const listener = vi.fn();
    const off = onSessionCleared(listener);

    clearSession();
    off();
    clearSession();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('[TC-01-03] resetSessionStore returns to unknown without firing cleared listeners', () => {
    const listener = vi.fn();
    const off = onSessionCleared(listener);
    setSession({ accessToken: 'a', user: TEST_USER });

    resetSessionStore();
    off();

    expect(getSession().status).toBe('unknown');
    expect(listener).not.toHaveBeenCalled();
  });

  it('[TC-01-03] useSession re-renders on changes', () => {
    const { result } = renderHook(() => useSession());
    expect(result.current.status).toBe('unknown');

    act(() => setSession({ accessToken: 'a', user: TEST_USER }));

    expect(result.current.status).toBe('authenticated');
    expect(result.current.user).toEqual(TEST_USER);
  });
});
