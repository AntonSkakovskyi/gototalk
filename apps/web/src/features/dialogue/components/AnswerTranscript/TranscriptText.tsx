import { UnstyledButton } from '@mantine/core';
import type { Segment } from '@/features/dialogue/lib/highlight-segments';
import classes from './AnswerTranscript.module.scss';

interface TranscriptTextProps {
  segments: Segment[];
  selectedId: string | null;
  detailsId: string;
  onSelect: (mistakeId: string) => void;
}

export function TranscriptText({
  segments,
  selectedId,
  detailsId,
  onSelect,
}: TranscriptTextProps) {
  return segments.map((segment) => {
    if (segment.kind === 'text') {
      return segment.text;
    }
    const { mistake } = segment;
    const expanded = mistake.id === selectedId;
    return (
      <UnstyledButton
        key={mistake.id}
        type="button"
        className={classes.fragment}
        aria-expanded={expanded}
        aria-controls={expanded ? detailsId : undefined}
        onClick={() => onSelect(mistake.id)}
      >
        {segment.text}
      </UnstyledButton>
    );
  });
}
