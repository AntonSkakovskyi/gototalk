import type { SessionReport } from '@gototalk/shared';
import type { UseQueryResult } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ReportSummary } from '@/features/report/components/ReportSummary/ReportSummary';
import { reportErrorKey } from '@/features/report/lib/report-errors';
import { LoadError } from '@/shared/ui/LoadError/LoadError';
import { SectionSkeleton } from '@/shared/ui/SectionSkeleton/SectionSkeleton';

interface ReportViewProps {
  query: UseQueryResult<SessionReport>;
}

export function ReportView({ query }: ReportViewProps) {
  const { t } = useTranslation();

  if (query.data) {
    return (
      <ReportSummary
        report={query.data}
        retrying={query.isFetching}
        onRetry={() => void query.refetch()}
      />
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
