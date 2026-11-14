import { Alert } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import type { RecorderStatus } from '@/features/dialogue/hooks/use-audio-recorder';
import {
  micHelpKind,
  type MicHelpKind,
} from '@/features/dialogue/lib/mic-help';

// A missing capability is a standing notice; a refusal or failure follows the user's tap and is announced at once.
const STANDING_NOTICES = new Set<MicHelpKind>(['insecure', 'unsupported']);

interface MicPermissionHelpProps {
  status: RecorderStatus;
  errorName: string | null;
  insecureContext: boolean;
}

export function MicPermissionHelp({
  status,
  errorName,
  insecureContext,
}: MicPermissionHelpProps) {
  const { t } = useTranslation();
  const kind = micHelpKind({ status, errorName, insecureContext });

  if (kind === null) {
    return null;
  }

  return (
    <Alert
      variant="default"
      role={STANDING_NOTICES.has(kind) ? 'status' : 'alert'}
      title={t(`dialogue.voice.help.${kind}.title`)}
    >
      {t(`dialogue.voice.help.${kind}.text`)}
    </Alert>
  );
}
