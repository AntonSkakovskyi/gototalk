import type { SessionDetails } from '@gototalk/shared';
import { Group, List, Stack, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { AnswerCard } from '@/features/dialogue/components/TurnList/AnswerCard';
import { QuestionCard } from '@/features/dialogue/components/TurnList/QuestionCard';
import { wholeMinutes } from '@/features/dialogue/lib/session-duration';
import { answersWithQuestions } from '@/features/dialogue/lib/turns';

const NO_MARKERS = 'none';

interface StatProps {
  label: string;
  value: string;
}

function Stat({ label, value }: StatProps) {
  return (
    <Stack gap={0}>
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text fw={500}>{value}</Text>
    </Stack>
  );
}

interface SessionRecapProps {
  details: SessionDetails;
  withStats?: boolean;
}

export function SessionRecap({ details, withStats = true }: SessionRecapProps) {
  const { t } = useTranslation();
  const pairs = answersWithQuestions(details.utterances);
  const minutes = wholeMinutes(details.startedAt, details.endedAt);

  return (
    <Stack gap="lg">
      {withStats && (
        <>
          <Title order={2}>{t('dialogue.recap.title')}</Title>
          <Group gap="xl">
            <Stat
              label={t('dialogue.recap.answersLabel')}
              value={t('dialogue.recap.answers', { count: pairs.length })}
            />
            {minutes !== null && (
              <Stat
                label={t('dialogue.recap.durationLabel')}
                value={
                  minutes === 0
                    ? t('dialogue.recap.underMinute')
                    : t('dialogue.recap.minutes', { count: minutes })
                }
              />
            )}
          </Group>
        </>
      )}
      {pairs.length > 0 && (
        <List
          listStyleType={NO_MARKERS}
          spacing="lg"
          aria-label={t('dialogue.recap.listLabel')}
        >
          {pairs.map(({ question, answer }) => (
            <List.Item key={answer.id}>
              <Stack gap="xs">
                {question && (
                  <QuestionCard text={question.text} current={false} />
                )}
                <AnswerCard
                  sessionId={details.id}
                  utterance={answer}
                  showFeedback
                />
              </Stack>
            </List.Item>
          ))}
        </List>
      )}
    </Stack>
  );
}
