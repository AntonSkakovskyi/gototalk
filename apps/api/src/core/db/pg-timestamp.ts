// Drizzle (mode: 'string') returns timestamptz as e.g. "2026-11-13 10:00:00.123456+00"
export function pgTimestampToDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Unparseable Postgres timestamp');
  }
  return date;
}
