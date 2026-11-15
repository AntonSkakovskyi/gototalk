import { z } from 'zod';
import { LLM_PROVIDERS, STT_PROVIDERS } from '../common/providers.js';

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
    stt: z.enum(STT_PROVIDERS),
    llm: z.enum(LLM_PROVIDERS),
  }),
});

export const DeleteAccountRequestSchema = z.object({
  password: z.string().min(1).max(128),
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type Me = z.infer<typeof MeSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type ConsentInfo = z.infer<typeof ConsentInfoSchema>;
export type DeleteAccountRequest = z.infer<typeof DeleteAccountRequestSchema>;
