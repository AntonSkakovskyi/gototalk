import type { Utterance } from '@gototalk/shared';
import { List, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { AnswerCard } from '@/entities/session/components/AnswerCard/AnswerCard';
import { PastQuestion } from '@/entities/session/components/PastQuestion/PastQuestion';

const NO_MARKERS = 'none';

interface AnswerListProps {
  sessionId: string;
  answers: Utterance[];
  questions: ReadonlyMap<string, Utterance>;
  labelledBy: string;
}

export function AnswerList({
  sessionId,
  answers,
  questions,
  labelledBy,
}: AnswerListProps) {
  const { t } = useTranslation();

  return (
    <List listStyleType={NO_MARKERS} spacing="lg" aria-labelledby={labelledBy}>
      {answers.map((answer) => {
        const question = questions.get(answer.id);
        return (
          <List.Item key={answer.id}>
            <Stack gap="xs">
              {question && <PastQuestion text={question.text} />}
              <AnswerCard
                sessionId={sessionId}
                utterance={answer}
                showFeedback
              />
              {answer.analysisStatus === 'failed' && (
                <Text size="sm" c="dimmed">
                  {t('report.deep.analysisFailed')}
                </Text>
              )}
            </Stack>
          </List.Item>
        );
      })}
    </List>
  );
}
