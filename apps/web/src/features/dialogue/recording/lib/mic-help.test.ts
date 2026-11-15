import { micHelpKind, voiceUnavailable } from './mic-help';

describe('micHelpKind', () => {
  it.each(['idle', 'requesting', 'recording'] as const)(
    '[TC-04-05] shows no help while the status is %s',
    (status) => {
      expect(
        micHelpKind({ status, errorName: null, insecureContext: false }),
      ).toBeNull();
    },
  );

  it('[TC-04-05] explains a denied permission', () => {
    expect(
      micHelpKind({
        status: 'denied',
        errorName: 'NotAllowedError',
        insecureContext: false,
      }),
    ).toBe('denied');
  });

  it('[TC-04-05] explains that an insecure page cannot record', () => {
    expect(
      micHelpKind({
        status: 'unsupported',
        errorName: null,
        insecureContext: true,
      }),
    ).toBe('insecure');
  });

  it('[TC-04-05] explains a browser without recording support', () => {
    expect(
      micHelpKind({
        status: 'unsupported',
        errorName: null,
        insecureContext: false,
      }),
    ).toBe('unsupported');
  });

  it.each(['NotFoundError', 'OverconstrainedError'])(
    '[TC-04-05] reports a missing microphone for %s',
    (errorName) => {
      expect(
        micHelpKind({ status: 'error', errorName, insecureContext: false }),
      ).toBe('notFound');
    },
  );

  it.each([null, 'NotReadableError', 'AbortError'])(
    '[TC-04-05] falls back to a generic message for the %s failure',
    (errorName) => {
      expect(
        micHelpKind({ status: 'error', errorName, insecureContext: false }),
      ).toBe('error');
    },
  );
});

describe('voiceUnavailable', () => {
  it.each([
    ['unsupported', true],
    ['denied', true],
    ['error', true],
    ['idle', false],
    ['requesting', false],
    ['recording', false],
  ] as const)('[TC-04-05] %s gives %s', (status, expected) => {
    expect(voiceUnavailable(status)).toBe(expected);
  });
});
