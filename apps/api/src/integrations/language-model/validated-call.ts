import type { z } from 'zod';

const LOGGER_CONTEXT = 'LanguageModel';
const MAX_ATTEMPTS = 2;

export interface ValidationLogger {
  warn(context: object, message: string, loggerName: string): void;
}

export class LanguageModelInvalidResponseError extends Error {
  constructor() {
    super('The language model returned an invalid response');
    this.name = 'LanguageModelInvalidResponseError';
  }
}

export async function requestValidated<T>(
  schema: z.ZodType<T>,
  call: () => Promise<unknown>,
  logger: ValidationLogger,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const parsed = schema.safeParse(await call());
    if (parsed.success) return parsed.data;
    // Only paths and codes are logged: messages and values can echo user text
    const issues = parsed.error.issues.map(({ path, code }) => ({
      path: path.map(String).join('.'),
      code,
    }));
    logger.warn(
      { attempt, issues },
      'Language model response failed validation',
      LOGGER_CONTEXT,
    );
  }
  throw new LanguageModelInvalidResponseError();
}
