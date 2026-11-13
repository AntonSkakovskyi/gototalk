import { describe, expect, it } from 'vitest';
import {
  AuthResponseSchema,
  ConsentInfoSchema,
  DeleteAccountRequestSchema,
  EmailSchema,
  ERROR_CODES,
  LoginRequestSchema,
  MeSchema,
  PasswordSchema,
  RegisterRequestSchema,
} from './index.js';

const userId = '3f2b8c1e-6d4a-4e0b-9a57-1c2d3e4f5a6b';

describe('auth schemas', () => {
  it('[TC-01-02] EmailSchema trims and lowercases', () => {
    expect(EmailSchema.parse(' A@B.com ')).toBe('a@b.com');
  });

  it('[TC-01-02] EmailSchema rejects an invalid email', () => {
    expect(EmailSchema.safeParse('not-an-email').success).toBe(false);
    expect(EmailSchema.safeParse('').success).toBe(false);
  });

  it('[TC-01-02] PasswordSchema rejects 7 chars, accepts 8, rejects 129', () => {
    expect(PasswordSchema.safeParse('a'.repeat(7)).success).toBe(false);
    expect(PasswordSchema.safeParse('a'.repeat(8)).success).toBe(true);
    expect(PasswordSchema.safeParse('a'.repeat(128)).success).toBe(true);
    expect(PasswordSchema.safeParse('a'.repeat(129)).success).toBe(false);
  });

  it('[TC-01-02] RegisterRequestSchema normalises the email and enforces the password length', () => {
    expect(
      RegisterRequestSchema.parse({
        email: ' A@B.com ',
        password: 'password-1',
      }),
    ).toEqual({ email: 'a@b.com', password: 'password-1' });
    expect(
      RegisterRequestSchema.safeParse({ email: 'a@b.com', password: 'short' })
        .success,
    ).toBe(false);
  });

  it('[TC-01-02] LoginRequestSchema does not enforce a minimum password length', () => {
    expect(
      LoginRequestSchema.parse({ email: ' A@B.com ', password: 'x' }),
    ).toEqual({ email: 'a@b.com', password: 'x' });
    expect(
      LoginRequestSchema.safeParse({ email: 'a@b.com', password: '' }).success,
    ).toBe(false);
    expect(
      LoginRequestSchema.safeParse({
        email: 'a@b.com',
        password: 'a'.repeat(129),
      }).success,
    ).toBe(false);
  });

  it('[TC-01-02] MeSchema accepts a null and an ISO consentAt', () => {
    const me = { id: userId, email: 'a@b.com', consentAt: null };
    expect(MeSchema.parse(me)).toEqual(me);
    const consented = { ...me, consentAt: '2026-11-13T10:00:00.000Z' };
    expect(MeSchema.parse(consented)).toEqual(consented);
    expect(MeSchema.safeParse({ ...me, consentAt: 'yesterday' }).success).toBe(
      false,
    );
  });

  it('[TC-01-02] AuthResponseSchema accepts consentAt null and rejects a non-uuid id', () => {
    const response = {
      accessToken: 'token',
      user: { id: userId, email: 'a@b.com', consentAt: null },
    };
    expect(AuthResponseSchema.parse(response)).toEqual(response);
    expect(
      AuthResponseSchema.safeParse({
        ...response,
        user: { ...response.user, id: 'not-a-uuid' },
      }).success,
    ).toBe(false);
    expect(AuthResponseSchema.safeParse({ user: response.user }).success).toBe(
      false,
    );
  });

  it('[TC-01-02] ConsentInfoSchema accepts known providers and rejects unknown ones', () => {
    const info = {
      consentAt: null,
      providers: { stt: 'deepgram', llm: 'gemini' },
    };
    expect(ConsentInfoSchema.parse(info)).toEqual(info);
    expect(
      ConsentInfoSchema.safeParse({
        ...info,
        providers: { stt: 'whisper', llm: 'gemini' },
      }).success,
    ).toBe(false);
  });

  it('[TC-01-02] DeleteAccountRequestSchema rejects an empty password', () => {
    expect(DeleteAccountRequestSchema.parse({ password: 'x' })).toEqual({
      password: 'x',
    });
    expect(DeleteAccountRequestSchema.safeParse({ password: '' }).success).toBe(
      false,
    );
  });

  it('[TC-01-02] ERROR_CODES lists the error codes', () => {
    expect(ERROR_CODES).toEqual({
      INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
      EMAIL_TAKEN: 'EMAIL_TAKEN',
      INVALID_PASSWORD: 'INVALID_PASSWORD',
      CONSENT_REQUIRED: 'CONSENT_REQUIRED',
      PROFILE_NOT_FOUND: 'PROFILE_NOT_FOUND',
      GOAL_NOT_FOUND: 'GOAL_NOT_FOUND',
      ACTIVE_GOALS_LIMIT: 'ACTIVE_GOALS_LIMIT',
      SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
      LANGUAGE_MODEL_INVALID_RESPONSE: 'LANGUAGE_MODEL_INVALID_RESPONSE',
      LANGUAGE_MODEL_UNAVAILABLE: 'LANGUAGE_MODEL_UNAVAILABLE',
      ANSWER_NOT_EXPECTED: 'ANSWER_NOT_EXPECTED',
      SESSION_FINISHED: 'SESSION_FINISHED',
      UTTERANCE_NOT_FOUND: 'UTTERANCE_NOT_FOUND',
      MISTAKE_NOT_FOUND: 'MISTAKE_NOT_FOUND',
    });
  });
});
