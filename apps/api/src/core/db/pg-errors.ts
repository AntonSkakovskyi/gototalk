const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';

// Drizzle wraps driver errors in DrizzleQueryError with the original on `cause`
function hasPgCode(error: unknown, code: string): boolean {
  for (let current = error; current instanceof Error; current = current.cause) {
    if ('code' in current && current.code === code) return true;
  }
  return false;
}

export function isUniqueViolation(error: unknown): boolean {
  return hasPgCode(error, UNIQUE_VIOLATION);
}

export function isForeignKeyViolation(error: unknown): boolean {
  return hasPgCode(error, FOREIGN_KEY_VIOLATION);
}
