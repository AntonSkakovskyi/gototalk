import { onboardingRedirectTarget } from './onboarding-redirect';

describe('onboardingRedirectTarget', () => {
  it('[TC-02-03] returns the origin path from the location state', () => {
    expect(onboardingRedirectTarget({ from: '/words' })).toBe('/words');
    expect(onboardingRedirectTarget({ from: '/history?x=1' })).toBe(
      '/history?x=1',
    );
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
    ];

    for (const state of unsafe) {
      expect(onboardingRedirectTarget(state)).toBe('/');
    }
  });
});
