import type { Location } from 'react-router';

const ONBOARDING_PATH = '/onboarding';

function isSafeTarget(path: string): boolean {
  if (
    !path.startsWith('/') ||
    path.startsWith('//') ||
    path.includes('\\') ||
    // browsers strip tab/CR/LF, so '/\t/evil' would become '//evil'
    /[\s\p{Cc}]/u.test(path)
  ) {
    return false;
  }
  const [pathname = ''] = path.split(/[?#]/);
  const normalized = pathname.toLowerCase().replace(/\/+$/, '');
  return (
    normalized !== ONBOARDING_PATH &&
    !normalized.startsWith(`${ONBOARDING_PATH}/`)
  );
}

export function redirectState({
  pathname,
  search,
}: Pick<Location, 'pathname' | 'search'>): { from: string } {
  return { from: `${pathname}${search}` };
}

export function safeRedirectTarget(state: unknown): string {
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
