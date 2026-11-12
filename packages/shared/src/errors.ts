import { z } from 'zod';

/** Єдиний формат помилок API. */
export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
