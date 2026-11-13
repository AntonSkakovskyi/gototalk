import {
  AuthResponseSchema,
  ConsentInfoSchema,
  MeSchema,
  type ConsentInfo,
  type LoginRequest,
  type RegisterRequest,
} from '@gototalk/shared';
import { ApiError, apiFetch } from '@/shared/api/http';
import {
  clearSession,
  setSession,
  updateUser,
} from '@/shared/session/session-store';

export async function register(request: RegisterRequest): Promise<void> {
  const auth = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: request,
    schema: AuthResponseSchema,
    auth: false,
  });
  setSession(auth);
}

export async function login(request: LoginRequest): Promise<void> {
  const auth = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: request,
    schema: AuthResponseSchema,
    auth: false,
  });
  setSession(auth);
}

export async function logout(): Promise<void> {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST', auth: false });
  } catch (error) {
    // A 4xx is final: retrying cannot help, so the local session is cleared.
    if (!(error instanceof ApiError) || error.status >= 500) {
      throw error;
    }
  }
  clearSession();
}

export async function grantConsent(): Promise<void> {
  updateUser(
    await apiFetch('/api/me/consent', { method: 'POST', schema: MeSchema }),
  );
}

export function getConsentInfo(): Promise<ConsentInfo> {
  return apiFetch('/api/me/consent', { schema: ConsentInfoSchema });
}

export async function deleteAccount(password: string): Promise<void> {
  await apiFetch('/api/me', { method: 'DELETE', body: { password } });
  clearSession();
}
