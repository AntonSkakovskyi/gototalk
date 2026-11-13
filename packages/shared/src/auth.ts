import { z } from 'zod';

export const EmailSchema = z.string().trim().toLowerCase().pipe(z.email());

export const PasswordSchema = z.string().min(8).max(128);

export const RegisterRequestSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
});

export const LoginRequestSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1).max(128),
});

export const MeSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  consentAt: z.iso.datetime().nullable(),
});

export const AuthResponseSchema = z.object({
  accessToken: z.string().min(1),
  user: MeSchema,
});

export const ConsentInfoSchema = z.object({
  consentAt: z.iso.datetime().nullable(),
  providers: z.object({
    stt: z.enum(['fake', 'deepgram']),
    llm: z.enum(['fake', 'gemini']),
  }),
});

export const DeleteAccountRequestSchema = z.object({
  password: z.string().min(1).max(128),
});

export const ERROR_CODES = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  INVALID_PASSWORD: 'INVALID_PASSWORD',
  CONSENT_REQUIRED: 'CONSENT_REQUIRED',
  PROFILE_NOT_FOUND: 'PROFILE_NOT_FOUND',
  GOAL_NOT_FOUND: 'GOAL_NOT_FOUND',
  ACTIVE_GOALS_LIMIT: 'ACTIVE_GOALS_LIMIT',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  LANGUAGE_MODEL_INVALID_RESPONSE: 'LANGUAGE_MODEL_INVALID_RESPONSE',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type Me = z.infer<typeof MeSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type ConsentInfo = z.infer<typeof ConsentInfoSchema>;
export type DeleteAccountRequest = z.infer<typeof DeleteAccountRequestSchema>;
