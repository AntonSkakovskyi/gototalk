import type { SessionDetails } from '@gototalk/shared';
import { List } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { currentQuestion, sortBySeq } from '@/features/dialogue/lib/turns';
import { useFocusWhen } from '@/shared/hooks/use-focus-when';
import { AnswerCard } from './AnswerCard';
import { QuestionCard } from './QuestionCard';

const NO_MARKERS = 'none';

interface TurnListProps {
  details: SessionDetails;
}

export function TurnList({ details }: TurnListProps) {
  const { t } = useTranslation();
  const turns = sortBySeq(details.utterances);
  const currentId = currentQuestion(turns)?.id;
  const [initialId] = useState(currentId);
  const currentRef = useFocusWhen<HTMLDivElement>(
    currentId !== initialId,
    currentId,
  );

  return (
    <List
      listStyleType={NO_MARKERS}
      spacing="md"
      aria-label={t('dialogue.turns.label')}
    >
      {turns.map((turn) => (
        <List.Item key={turn.id}>
          {turn.role === 'assistant' ? (
            <QuestionCard
              ref={turn.id === currentId ? currentRef : undefined}
              text={turn.text}
              current={turn.id === currentId}
            />
          ) : (
            <AnswerCard
              sessionId={details.id}
              utterance={turn}
              showFeedback={details.feedbackMode === 'immediate'}
            />
          )}
        </List.Item>
      ))}
    </List>
  );
}
