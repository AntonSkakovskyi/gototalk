import { Button, Stack } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams } from 'react-router';
import { SessionRecap } from '@/features/dialogue/components/SessionRecap/SessionRecap';
import { SessionOverview } from '@/features/session/components/SessionOverview/SessionOverview';
import { sessionDetailsQueryOptions } from '@/shared/api/session-details';
import { sessionPath } from '@/shared/router/session-paths';

export function ReportPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const details = useQuery(sessionDetailsQueryOptions(id));

  if (details.data?.status === 'active' && !details.isFetching) {
    return <Navigate to={sessionPath(id)} replace />;
  }

  return (
    <Stack gap="lg">
      <SessionOverview details={details} />
      {details.data && <SessionRecap details={details.data} />}
      <Button component={Link} to="/" variant="subtle" size="lg">
        {t('common.actions.home')}
      </Button>
    </Stack>
  );
}
