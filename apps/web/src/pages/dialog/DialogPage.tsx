import { Button, Stack } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { DialogueScreen } from '@/features/dialogue/components/DialogueScreen/DialogueScreen';
import { SessionOverview } from '@/features/session/components/SessionOverview/SessionOverview';
import { sessionDetailsQueryOptions } from '@/entities/session/api/session-details';

export function DialogPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const details = useQuery(sessionDetailsQueryOptions(id));

  return (
    <Stack gap="lg">
      <SessionOverview details={details} />
      {details.data && <DialogueScreen details={details.data} />}
      <Button component={Link} to="/" variant="subtle" size="lg">
        {t('common.actions.home')}
      </Button>
    </Stack>
  );
}
