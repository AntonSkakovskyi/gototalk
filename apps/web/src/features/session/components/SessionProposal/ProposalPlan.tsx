import type { SessionPlan } from '@gototalk/shared';
import { Alert, Button, Stack } from '@mantine/core';
import type { UseQueryResult } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useFocusWhen } from '@/shared/hooks/use-focus-when';
import { sessionErrorKey } from '@/features/session/lib/session-errors';
import { SectionSkeleton } from '@/shared/ui/SectionSkeleton/SectionSkeleton';
import { PlanContent } from './PlanContent';

interface ProposalPlanProps {
  plan: UseQueryResult<SessionPlan>;
  focusTopic: boolean;
}

interface PlanErrorProps {
  error: Error;
  focusRetry: boolean;
  onRetry: () => void;
}

function PlanError({ error, focusRetry, onRetry }: PlanErrorProps) {
  const { t } = useTranslation();
  const retryRef = useFocusWhen<HTMLButtonElement>(focusRetry);

  return (
    <Stack gap="sm" align="flex-start">
      <Alert color="red" role="alert" w="100%">
        {t(sessionErrorKey(error).key)}
      </Alert>
      <Button ref={retryRef} variant="light" size="lg" onClick={onRetry}>
        {t('common.actions.retry')}
      </Button>
    </Stack>
  );
}

export function ProposalPlan({ plan, focusTopic }: ProposalPlanProps) {
  if (plan.data) {
    return <PlanContent plan={plan.data} focusTopic={focusTopic} />;
  }
  if (plan.isError && !plan.isFetching) {
    return (
      <PlanError
        error={plan.error}
        focusRetry={focusTopic}
        onRetry={() => void plan.refetch()}
      />
    );
  }
  return <SectionSkeleton />;
}
