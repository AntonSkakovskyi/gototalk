import { wholeMinutes } from './session-duration';

const STARTED = '2026-11-13T10:00:00.000Z';

describe('wholeMinutes', () => {
  it.each([
    ['2026-11-13T10:00:00.000Z', 0],
    ['2026-11-13T10:00:59.999Z', 0],
    ['2026-11-13T10:01:00.000Z', 1],
    ['2026-11-13T10:02:30.000Z', 2],
    ['2026-11-13T10:05:00.000Z', 5],
    ['2026-11-13T10:21:00.000Z', 21],
    ['2026-11-13T12:10:00.000Z', 130],
  ])('[TC-04-05] counts whole minutes until %s as %i', (endedAt, minutes) => {
    expect(wholeMinutes(STARTED, endedAt)).toBe(minutes);
  });

  it('[TC-04-05] is unknown while the session has no end', () => {
    expect(wholeMinutes(STARTED, null)).toBeNull();
  });

  it('[TC-04-05] never goes below zero when the clocks disagree', () => {
    expect(wholeMinutes(STARTED, '2026-11-13T09:59:00.000Z')).toBe(0);
  });
});
