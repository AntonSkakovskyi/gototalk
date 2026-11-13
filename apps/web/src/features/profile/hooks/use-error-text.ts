import { useTranslation } from 'react-i18next';
import type { ProfileErrorMessage } from '@/features/profile/lib/profile-errors';

export function useErrorText() {
  const { t } = useTranslation();
  return (message: ProfileErrorMessage | null | undefined) =>
    message ? t(message.key, { ...message.values }) : undefined;
}
