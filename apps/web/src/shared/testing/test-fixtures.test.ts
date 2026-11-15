import { SessionReportSchema, WordSchema } from '@gototalk/shared';
import { testReport, testWord } from './test-fixtures';

describe('report fixtures', () => {
  it('[TC-05-03] testWord is a valid Word and takes overrides', () => {
    expect(WordSchema.parse(testWord())).toEqual(testWord());
    expect(testWord({ state: 'active' }).state).toBe('active');
  });

  it('[TC-05-03] testReport is a valid SessionReport and takes overrides', () => {
    expect(SessionReportSchema.parse(testReport())).toEqual(testReport());
    expect(testReport({ answers: 9 }).answers).toBe(9);
  });

  it('[TC-05-03] testReport words have distinct ids', () => {
    const ids = testReport().words.map((word) => word.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});
