import type { Session } from '@gototalk/shared';
import { Badge, Button, Group, Paper, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import classes from './SessionListItem.module.scss';
import { formatSessionDate } from '@/features/session/lib/format-session-date';

interface SessionListItemProps {
  session: Session;
}

export function SessionListItem({ session }: SessionListItemProps) {
  const { t, i18n } = useTranslation();
  const isActive = session.status === 'active';

  return (
    <Paper
      component={Link}
      to={`/sessions/${session.id}`}
      withBorder
      p="md"
      className={classes.item}
    >
      <Stack gap="xs">
        <Text fw={500}>{session.topic}</Text>
        <Group justify="space-between" gap="xs">
          <Text size="sm" c="dimmed">
            {formatSessionDate(session.startedAt, i18n.language)}
          </Text>
          <Badge color={isActive ? 'blue' : 'gray'} variant="light">
            {t(`session.home.status.${session.status}`)}
          </Badge>
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
