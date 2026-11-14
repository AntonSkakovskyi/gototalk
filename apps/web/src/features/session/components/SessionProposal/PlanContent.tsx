import type { SessionPlan } from '@gototalk/shared';
import { Badge, Group, List, Stack, Text, Title } from '@mantine/core';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useFocusWhen } from '@/shared/hooks/use-focus-when';
import { topicLanguage } from '@/features/session/lib/topic-language';

const QUESTION_LANGUAGE = 'en';

interface PlanContentProps {
  plan: SessionPlan;
  focusTopic: boolean;
}

function TopicHeading({ plan, focusTopic }: PlanContentProps) {
  const { t } = useTranslation();
  const headingRef = useFocusWhen<HTMLHeadingElement>(focusTopic, plan.topic);

  return (
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
        ref={headingRef}
      >
        {plan.topic}
      </Title>
    </Stack>
  );
}

function QuestionList({ questions }: { questions: string[] }) {
  const { t } = useTranslation();
  const labelId = useId();

  return (
    <Stack gap="xs">
      <Text id={labelId} size="sm" fw={500}>
        {t('session.proposal.questionsLabel')}
      </Text>
      <List
        type="ordered"
        spacing="sm"
        lang={QUESTION_LANGUAGE}
        aria-labelledby={labelId}
      >
        {questions.map((question) => (
          <List.Item key={question}>{question}</List.Item>
        ))}
      </List>
    </Stack>
  );
}

export function PlanContent({ plan, focusTopic }: PlanContentProps) {
  return (
    <Stack gap="md">
      <TopicHeading plan={plan} focusTopic={focusTopic} />
      <QuestionList questions={plan.questions} />
    </Stack>
  );
}
