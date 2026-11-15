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
