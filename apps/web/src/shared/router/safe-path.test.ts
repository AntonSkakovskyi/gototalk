import { redirectState, safeRedirectTarget } from './safe-path';

describe('safeRedirectTarget', () => {
  it('[TC-02-03] returns the origin path from the location state', () => {
    expect(safeRedirectTarget({ from: '/words' })).toBe('/words');
    expect(safeRedirectTarget({ from: '/history?x=1' })).toBe('/history?x=1');
  });

  it('[TC-02-03] falls back to the root for missing or unsafe values', () => {
    const unsafe = [
      null,
      undefined,
      'words',
      {},
      { from: 5 },
      { from: 'words' },
      { from: '//evil.example' },
      { from: 'https://evil.example' },
      { from: '/onboarding' },
      { from: '/onboarding?step=2' },
      { from: '/onboarding/' },
      { from: '/onboarding/step/2' },
      { from: '/Onboarding' },
      { from: '/ONBOARDING/?x=1' },
      { from: '/\\evil.example' },
      { from: '/words\\x' },
      { from: '/\t/evil' },
      { from: '/\n/evil' },
      { from: '/ /evil' },
      { from: '/words\u0001' },
    ];

    for (const state of unsafe) {
      expect(safeRedirectTarget(state)).toBe('/');
    }
  });
});

describe('redirectState', () => {
  it('[TC-02-03] keeps the pathname together with the query string', () => {
    expect(redirectState({ pathname: '/history', search: '?x=1' })).toEqual({
      from: '/history?x=1',
    });
    expect(redirectState({ pathname: '/words', search: '' })).toEqual({
      from: '/words',
    });
  });

  it('[TC-02-03] produces a value that safeRedirectTarget accepts', () => {
    const state = redirectState({ pathname: '/history', search: '?x=1' });

    expect(safeRedirectTarget(state)).toBe('/history?x=1');
  });
});
