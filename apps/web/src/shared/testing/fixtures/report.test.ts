import { SessionReportSchema } from '@gototalk/shared';
import { testReport } from './report';

describe('report fixtures', () => {
  it('[TC-05-03] testReport is a valid SessionReport and takes overrides', () => {
    expect(SessionReportSchema.parse(testReport())).toEqual(testReport());
    expect(testReport({ answers: 9 }).answers).toBe(9);
  });

  it('[TC-05-03] testReport words have distinct ids', () => {
    const ids = testReport().words.map((word) => word.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});
