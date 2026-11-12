import { STATUS_CODES } from 'node:http';

// Стабільні коди для найчастіших статусів; решта береться зі стандартної назви статусу.
const KNOWN_CODES: Readonly<Record<number, string>> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_ERROR',
};

/** Машинний код помилки за HTTP-статусом: `404` → `NOT_FOUND`, `503` → `SERVICE_UNAVAILABLE`. */
export function codeFromStatus(status: number): string {
  const known = KNOWN_CODES[status];
  if (known) return known;

  const name = STATUS_CODES[status];
  if (name) {
    return name
      .replace(/['’]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase();
  }
  return status >= 500 ? 'INTERNAL_ERROR' : 'CLIENT_ERROR';
}
