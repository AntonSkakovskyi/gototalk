import type { AuthResponse, Me } from '@gototalk/shared';
import { useSyncExternalStore } from 'react';

export type SessionStatus = 'unknown' | 'anonymous' | 'authenticated';

export interface SessionState {
  status: SessionStatus;
  accessToken: string | null;
  user: Me | null;
}

// Never persisted: the access token lives only in this module's memory.
const INITIAL_STATE: SessionState = {
  status: 'unknown',
  accessToken: null,
  user: null,
};

let state: SessionState = INITIAL_STATE;
let generation = 0;
const changeListeners = new Set<() => void>();
const clearedListeners = new Set<() => void>();

function setState(next: SessionState): void {
  state = next;
  changeListeners.forEach((listener) => listener());
}

export function getSession(): SessionState {
  return state;
}

export function subscribeToSession(listener: () => void): () => void {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
}

export function useSession(): SessionState {
  return useSyncExternalStore(subscribeToSession, getSession);
}

// Lets an in-flight refresh detect that the session ended while it was waiting for the server.
export function getSessionGeneration(): number {
  return generation;
}

export function setSession({ accessToken, user }: AuthResponse): void {
  setState({ status: 'authenticated', accessToken, user });
}

export function clearSession(): void {
  generation += 1;
  setState({ status: 'anonymous', accessToken: null, user: null });
  clearedListeners.forEach((listener) => listener());
}

export function updateUser(user: Me): void {
  if (state.status !== 'authenticated') {
    return;
  }
  setState({ ...state, user });
}

export function onSessionCleared(listener: () => void): () => void {
  clearedListeners.add(listener);
  return () => {
    clearedListeners.delete(listener);
  };
}

export function resetSessionStore(): void {
  generation += 1;
  setState(INITIAL_STATE);
}
