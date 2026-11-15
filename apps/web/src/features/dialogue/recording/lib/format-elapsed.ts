const SECONDS_PER_MINUTE = 60;
const SECOND_DIGITS = 2;

export function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = String(totalSeconds % SECONDS_PER_MINUTE).padStart(
    SECOND_DIGITS,
    '0',
  );
  return `${minutes}:${seconds}`;
}
