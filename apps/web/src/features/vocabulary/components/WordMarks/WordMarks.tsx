import {
  MARKABLE_WORD_STATES,
  MarkWordRequestSchema,
  type MarkWordRequest,
  type Word,
} from '@gototalk/shared';
import { Badge, SegmentedControl, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useMarkWord } from '@/features/vocabulary/hooks/use-mark-word';
import { wordErrorKey } from '@/features/vocabulary/lib/word-errors';
import classes from './WordMarks.module.scss';

interface WordMarksProps {
  word: Word;
}

type MarkableState = MarkWordRequest['state'];

function isMarkable(state: string): state is MarkableState {
  return MarkWordRequestSchema.shape.state.safeParse(state).success;
}

export function WordMarks({ word }: WordMarksProps) {
  const { t } = useTranslation();
  const { mark, isPendingFor, errorFor } = useMarkWord();
  const error = errorFor(word.id);
  const pending = isPendingFor(word.id);

  if (!isMarkable(word.state)) {
    return (
      <Badge variant="light" size="lg" tt="none">
        {t('vocabulary.activeBadge')}
      </Badge>
    );
  }

  return (
    <Stack gap="xs">
      <SegmentedControl
        fullWidth
        size="md"
        classNames={{ label: classes.label }}
        aria-label={t('vocabulary.marks.groupLabel', { lemma: word.lemma })}
        value={word.state}
        readOnly={pending}
        aria-busy={pending}
        data={MARKABLE_WORD_STATES.map((state) => ({
          value: state,
          label: t(`vocabulary.marks.${state}`),
        }))}
        onChange={(state) => {
          if (isMarkable(state)) {
            mark(word, state);
          }
        }}
      />
      <div aria-live="polite">
        {error && (
          <Text size="sm" c="red">
            {t(wordErrorKey(error).key)}
          </Text>
        )}
      </div>
    </Stack>
  );
}
