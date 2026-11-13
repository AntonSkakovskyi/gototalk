import type { Session } from '@gototalk/shared';
import { Group, Stack, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { SessionStatusBadge } from '@/features/session/components/SessionStatusBadge/SessionStatusBadge';

const TOPIC_LANGUAGE = 'en';

interface SessionSummaryProps {
  session: Session;
}

export function SessionSummary({ session }: SessionSummaryProps) {
  const { t } = useTranslation();

  return (
    <Stack gap="xs">
      <Group justify="space-between" gap="xs">
        <Text size="sm" c="dimmed">
          {t('session.details.topicLabel')}
        </Text>
        <SessionStatusBadge status={session.status} />
      </Group>
      <Title order={1} lang={TOPIC_LANGUAGE}>
        {session.topic}
      </Title>
      <Text size="sm" c="dimmed">
        {t(`session.details.feedbackMode.${session.feedbackMode}`)}
      </Text>
    </Stack>
  );
}
