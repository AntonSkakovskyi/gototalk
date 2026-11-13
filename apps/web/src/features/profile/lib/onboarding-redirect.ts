const ONBOARDING_PATH = '/onboarding';

function isSafeTarget(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    return false;
  }
  const [pathname = ''] = path.split(/[?#]/);
  const normalized = pathname.toLowerCase().replace(/\/+$/, '');
  return (
    normalized !== ONBOARDING_PATH &&
    !normalized.startsWith(`${ONBOARDING_PATH}/`)
  );
}

export function onboardingRedirectTarget(state: unknown): string {
  if (
    typeof state === 'object' &&
    state !== null &&
    'from' in state &&
    typeof state.from === 'string' &&
    isSafeTarget(state.from)
  ) {
    return state.from;
  }
  return '/';
}
