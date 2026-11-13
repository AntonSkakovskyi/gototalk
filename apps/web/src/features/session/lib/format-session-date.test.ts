import { formatSessionDate } from './format-session-date';

describe('formatSessionDate', () => {
  it('[TC-03-03] formats the date in the Ukrainian locale', () => {
    expect(formatSessionDate('2026-11-13T12:00:00.000Z', 'uk')).toContain(
      '13 лист. 2026',
    );
  });

  it('[TC-03-03] follows the language it is given', () => {
    expect(formatSessionDate('2026-11-13T12:00:00.000Z', 'en')).toContain(
      'Nov 13, 2026',
    );
  });

  it('[TC-03-03] includes the time of day', () => {
    expect(formatSessionDate('2026-11-13T12:00:00.000Z', 'uk')).toMatch(
      /\d{1,2}:\d{2}/,
    );
  });
});
