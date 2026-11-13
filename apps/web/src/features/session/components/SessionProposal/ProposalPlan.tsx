import type { SessionPlan } from '@gototalk/shared';
import {
  Alert,
  Badge,
  Button,
  Group,
  List,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import type { UseQueryResult } from '@tanstack/react-query';
import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { sessionErrorKey } from '@/features/session/lib/session-errors';
import { topicLanguage } from '@/features/session/lib/topic-language';
import { SectionSkeleton } from '@/shared/ui/SectionSkeleton/SectionSkeleton';

const QUESTION_LANGUAGE = 'en';

interface ProposalPlanProps {
  plan: UseQueryResult<SessionPlan>;
  focusTopic: boolean;
}

interface PlanContentProps {
  plan: SessionPlan;
  focusTopic: boolean;
}

function PlanContent({ plan, focusTopic }: PlanContentProps) {
  const { t } = useTranslation();
  const questionsId = useId();
  const topicRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (focusTopic) {
      topicRef.current?.focus();
    }
  }, [plan.topic, focusTopic]);

  return (
    <Stack gap="md">
      <Stack gap={0}>
        <Group gap="xs">
          <Text size="sm" c="dimmed">
            {t('session.proposal.topicLabel')}
          </Text>
          {plan.topicSource === 'custom' && (
            <Badge variant="light" size="lg">
              {t('session.proposal.custom.badge')}
            </Badge>
          )}
        </Group>
        <Title
          order={2}
          lang={topicLanguage(plan.topicSource)}
          tabIndex={-1}
          ref={topicRef}
        >
          {plan.topic}
        </Title>
      </Stack>
      <Stack gap="xs">
        <Text id={questionsId} size="sm" fw={500}>
          {t('session.proposal.questionsLabel')}
        </Text>
        <List
          type="ordered"
          spacing="sm"
          lang={QUESTION_LANGUAGE}
          aria-labelledby={questionsId}
        >
          {plan.questions.map((question) => (
            <List.Item key={question}>{question}</List.Item>
          ))}
        </List>
      </Stack>
    </Stack>
  );
}

interface PlanErrorProps {
  error: Error;
  focusRetry: boolean;
  onRetry: () => void;
}

function PlanError({ error, focusRetry, onRetry }: PlanErrorProps) {
  const { t } = useTranslation();
  const retryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (focusRetry) {
      retryRef.current?.focus();
    }
  }, [focusRetry]);

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
