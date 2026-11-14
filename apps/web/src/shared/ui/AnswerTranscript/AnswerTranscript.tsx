import type { Utterance } from '@gototalk/shared';
import { Stack, Text, VisuallyHidden } from '@mantine/core';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BetterPhrasings } from '@/shared/ui/BetterPhrasings/BetterPhrasings';
import { MistakeDetails } from '@/shared/ui/MistakeDetails/MistakeDetails';
import { buildSegments } from './highlight-segments';
import { useFocusWhen } from '@/shared/hooks/use-focus-when';
import { ENGLISH_LANG } from '@/shared/i18n/languages';
import classes from './AnswerTranscript.module.scss';
import { TranscriptText } from './TranscriptText';

interface AnswerTranscriptProps {
  sessionId: string;
  utterance: Utterance;
  showFeedback: boolean;
}

export function AnswerTranscript({
  sessionId,
  utterance,
  showFeedback,
}: AnswerTranscriptProps) {
  const { t } = useTranslation();
  const detailsId = useId();
  const hintId = useId();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const analysed = showFeedback && utterance.analysisStatus === 'done';
  const segments = buildSegments(
    utterance.text,
    analysed ? utterance.mistakes : [],
  );
  const selected = segments.find(
    (segment) =>
      segment.kind === 'mistake' && segment.mistake.id === selectedId,
  );
  const hasFragments = segments.some((segment) => segment.kind === 'mistake');
  // The open fragment vanished: it was marked as not a mistake.
  const markedAway = selectedId !== null && selected === undefined;
  const textRef = useFocusWhen<HTMLParagraphElement>(markedAway);

  if (!showFeedback) {
    return <Text lang={ENGLISH_LANG}>{utterance.text}</Text>;
  }

  return (
    <Stack gap="sm">
      <Text
        ref={textRef}
        tabIndex={-1}
        lang={ENGLISH_LANG}
        className={classes.text}
      >
        <TranscriptText
          segments={segments}
          selectedId={selectedId}
          detailsId={detailsId}
          hintId={hintId}
          onSelect={(id) => setSelectedId(id === selectedId ? null : id)}
        />
      </Text>
      {hasFragments && (
        <VisuallyHidden id={hintId}>
          {t('transcript.mistake.fragmentHint')}
        </VisuallyHidden>
      )}
      {selectedId !== null && (
        <div aria-live="polite">
          {markedAway && (
            <Text size="sm" c="dimmed">
              {t('transcript.mistake.markedAsNotMistake')}
            </Text>
          )}
        </div>
      )}
      {selected?.kind === 'mistake' && (
        <MistakeDetails
          key={selected.mistake.id}
          id={detailsId}
          sessionId={sessionId}
          mistake={selected.mistake}
        />
      )}
      <BetterPhrasings phrasings={utterance.better} />
    </Stack>
  );
}
