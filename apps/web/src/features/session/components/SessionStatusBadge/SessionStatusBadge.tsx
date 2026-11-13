import type { Session } from '@gototalk/shared';
import { Badge } from '@mantine/core';
import { useTranslation } from 'react-i18next';

interface SessionStatusBadgeProps {
  status: Session['status'];
}

export function SessionStatusBadge({ status }: SessionStatusBadgeProps) {
  const { t } = useTranslation();

  return (
    <Badge color={status === 'active' ? 'blue' : 'gray'} variant="light">
      {t(`session.status.${status}`)}
    </Badge>
  );
}
