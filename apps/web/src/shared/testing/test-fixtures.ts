import type { AuthResponse, Me } from '@gototalk/shared';

export const TEST_USER: Me = {
  id: '0b7f4f7e-3d3a-4f0a-9a57-0c6d3b1a0001',
  email: 'anna@example.com',
  consentAt: null,
};

export function authResponse(
  accessToken = 'access-1',
  user: Me = TEST_USER,
): AuthResponse {
  return { accessToken, user };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function errorResponse(
  status: number,
  code: string,
  message = 'Error message',
): Response {
  return jsonResponse({ error: { code, message } }, status);
}

export function emptyResponse(status = 204): Response {
  return new Response(null, { status });
}
