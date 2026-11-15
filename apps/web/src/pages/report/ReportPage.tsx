import { Button, Stack } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams } from 'react-router';
import { ReportView } from '@/features/report/components/ReportView/ReportView';
import { SessionOverview } from '@/features/session/components/SessionOverview/SessionOverview';
import { SessionWords } from '@/features/vocabulary/components/SessionWords/SessionWords';
import { reportQueryOptions } from '@/features/report/api/report-queries';
import { sessionDetailsQueryOptions } from '@/shared/api/session-details';
import { sessionPath } from '@/shared/router/session-paths';

export function ReportPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const details = useQuery(sessionDetailsQueryOptions(id));
  const finished = details.data?.status === 'finished';
  const report = useQuery({ ...reportQueryOptions(id), enabled: finished });

  if (details.data?.status === 'active' && !details.isFetching) {
    return <Navigate to={sessionPath(id)} replace />;
  }

  return (
    <Stack gap="lg">
      <SessionOverview details={details} />
      {finished && (
        <ReportView query={report} details={details.data}>
          {report.data && <SessionWords words={report.data.words} />}
        </ReportView>
      )}
      <Button component={Link} to="/" variant="subtle" size="lg">
        {t('common.actions.home')}
      </Button>
    </Stack>
  );
}
