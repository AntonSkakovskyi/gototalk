import type { SessionDetails, SessionReport } from '@gototalk/shared';
import { Stack } from '@mantine/core';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { DeepAnalysis } from '@/features/report/components/DeepAnalysis/DeepAnalysis';
import { ReportSummary } from '@/features/report/components/ReportSummary/ReportSummary';
import { reportErrorKey } from '@/features/report/lib/report-errors';
import { LoadError } from '@/shared/ui/LoadError/LoadError';
import { SectionSkeleton } from '@/shared/ui/SectionSkeleton/SectionSkeleton';

interface ReportViewProps {
  query: UseQueryResult<SessionReport>;
  details?: SessionDetails;
  children?: ReactNode;
}

export function ReportView({ query, details, children }: ReportViewProps) {
  const { t } = useTranslation();

  if (query.data) {
    return (
      <Stack gap="lg">
        <ReportSummary
          report={query.data}
          retrying={query.isFetching}
          onRetry={() => void query.refetch()}
        />
        {children}
        {details && <DeepAnalysis details={details} report={query.data} />}
      </Stack>
    );
  }
  if (query.isError) {
    return (
      <LoadError
        message={t(reportErrorKey(query.error).key)}
        onRetry={() => void query.refetch()}
      />
    );
  }
  return <SectionSkeleton />;
}
