const MS_PER_MINUTE = 60_000;

export function wholeMinutes(
  startedAt: string,
  endedAt: string | null,
): number | null {
  if (endedAt === null) {
    return null;
  }
  const elapsed = Date.parse(endedAt) - Date.parse(startedAt);
  return Math.max(0, Math.floor(elapsed / MS_PER_MINUTE));
}
