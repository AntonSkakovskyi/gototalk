import type { Options } from 'pino-http';
import type { Env } from '../config/env.schema.js';

/** Заголовки, значення яких не можна писати в лог. */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
] as const;

export function buildPinoHttpOptions(
  env: Pick<Env, 'NODE_ENV' | 'LOG_LEVEL'>,
): Options {
  return {
    level: env.LOG_LEVEL,
    redact: { paths: [...REDACT_PATHS], censor: '[REDACTED]' },
    // Людиночитний вивід лише поза production; у production лишається JSON
    ...(env.NODE_ENV !== 'production' && {
      transport: { target: 'pino-pretty', options: { singleLine: true } },
    }),
  };
}
