import type { Utterance } from '@gototalk/shared';
import { Stack, Text } from '@mantine/core';
import { useId, useState } from 'react';
import { BetterPhrasings } from '@/features/dialogue/components/BetterPhrasings/BetterPhrasings';
import { MistakeDetails } from '@/features/dialogue/components/MistakeDetails/MistakeDetails';
import { buildSegments } from '@/features/dialogue/lib/highlight-segments';
import classes from './AnswerTranscript.module.scss';
import { TranscriptText } from './TranscriptText';

const ANSWER_LANGUAGE = 'en';

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
  const detailsId = useId();
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

  if (!showFeedback) {
    return <Text lang={ANSWER_LANGUAGE}>{utterance.text}</Text>;
  }

  return (
    <Stack gap="sm">
      <Text lang={ANSWER_LANGUAGE} className={classes.text}>
        <TranscriptText
          segments={segments}
          selectedId={selectedId}
          detailsId={detailsId}
          onSelect={(id) => setSelectedId(id === selectedId ? null : id)}
        />
      </Text>
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
