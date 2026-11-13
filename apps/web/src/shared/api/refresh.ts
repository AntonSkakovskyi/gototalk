import { AuthResponseSchema } from '@gototalk/shared';
import { toApiError } from './api-error';
import {
  clearSession,
  getSessionGeneration,
  setSession,
} from '@/shared/session/session-store';

const REFRESH_LOCK = 'gototalk-refresh';

let inFlight: Promise<boolean> | null = null;

async function requestRefresh(): Promise<boolean> {
  const generation = getSessionGeneration();
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'same-origin',
  });

  if (response.status === 401) {
    clearSession();
    return false;
  }
  if (!response.ok) {
    throw await toApiError(response);
  }

  const auth = AuthResponseSchema.parse(await response.json());
  if (getSessionGeneration() !== generation) {
    return false;
  }
  setSession(auth);
  return true;
}

// A rotated refresh cookie is invalidated by a concurrent refresh, so tabs take turns.
function refreshExclusively(): Promise<boolean> {
  if ('locks' in navigator) {
    return navigator.locks.request(REFRESH_LOCK, requestRefresh);
  }
  return requestRefresh();
}

/** Resolves true when a session was restored, false when the refresh cookie is missing or rejected. */
export function refreshSession(): Promise<boolean> {
  inFlight ??= refreshExclusively().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
