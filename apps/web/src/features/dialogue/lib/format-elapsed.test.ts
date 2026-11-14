import { formatElapsed } from './format-elapsed';

describe('formatElapsed', () => {
  it.each([
    [0, '0:00'],
    [7, '0:07'],
    [59, '0:59'],
    [60, '1:00'],
    [75, '1:15'],
    [120, '2:00'],
  ])('[TC-04-05] formats %i seconds as %s', (seconds, text) => {
    expect(formatElapsed(seconds)).toBe(text);
  });
});
