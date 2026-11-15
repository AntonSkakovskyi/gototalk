import type { Session } from '@gototalk/shared';
import { Button, Group, Paper, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import classes from './SessionListItem.module.scss';
import { SessionStatusBadge } from '@/features/session/components/SessionStatusBadge/SessionStatusBadge';
import { formatSessionDate } from '@/features/session/lib/format-session-date';
import { topicLanguage } from '@/features/session/lib/topic-language';
import { reportPath, sessionPath } from '@/shared/router/session-paths';

interface SessionListItemProps {
  session: Session;
}

export function SessionListItem({ session }: SessionListItemProps) {
  const { t, i18n } = useTranslation();
  const isActive = session.status === 'active';

  return (
    <Paper
      component={Link}
      to={isActive ? sessionPath(session.id) : reportPath(session.id)}
      withBorder
      p="md"
      className={classes.item}
    >
      <Stack gap="xs">
        <Text fw={500} lang={topicLanguage(session.topicSource)}>
          {session.topic}
        </Text>
        <Group justify="space-between" gap="xs">
          <Text size="sm" c="dimmed">
            {formatSessionDate(session.startedAt, i18n.language)}
          </Text>
          <SessionStatusBadge status={session.status} />
        </Group>
        {isActive && (
          <Button component="span" variant="light" fullWidth>
            {t('session.home.continue')}
          </Button>
        )}
      </Stack>
    </Paper>
  );
}
