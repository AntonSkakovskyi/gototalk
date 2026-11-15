import type { RecorderStatus } from '@/features/dialogue/recording/lib/recorder-status';

export type MicHelpKind =
  'denied' | 'insecure' | 'unsupported' | 'notFound' | 'error';

interface RecorderProblem {
  status: RecorderStatus;
  errorName: string | null;
  insecureContext: boolean;
}

const MISSING_DEVICE_ERRORS = new Set([
  'NotFoundError',
  'OverconstrainedError',
]);

export function voiceUnavailable(status: RecorderStatus): boolean {
  return status === 'unsupported' || status === 'denied' || status === 'error';
}

export function micHelpKind({
  status,
  errorName,
  insecureContext,
}: RecorderProblem): MicHelpKind | null {
  if (status === 'denied') {
    return 'denied';
  }
  if (status === 'unsupported') {
    return insecureContext ? 'insecure' : 'unsupported';
  }
  if (status !== 'error') {
    return null;
  }
  return errorName !== null && MISSING_DEVICE_ERRORS.has(errorName)
    ? 'notFound'
    : 'error';
}
