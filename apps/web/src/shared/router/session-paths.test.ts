import { reportPath, sessionPath } from './session-paths';

describe('session paths', () => {
  it('[TC-04-04] builds the dialogue path of a session', () => {
    expect(sessionPath('abc')).toBe('/sessions/abc');
  });

  it('[TC-04-04] builds the report path next to the dialogue path', () => {
    expect(reportPath('abc')).toBe('/sessions/abc/report');
  });
});
