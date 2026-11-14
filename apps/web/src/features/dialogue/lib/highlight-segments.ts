import type { MistakeView } from '@gototalk/shared';

export type Segment =
  | { kind: 'text'; text: string }
  | { kind: 'mistake'; text: string; mistake: MistakeView };

function matchesText(text: string, mistake: MistakeView): boolean {
  const { start, end, original, isFalse } = mistake;
  return (
    !isFalse &&
    start >= 0 &&
    end > start &&
    end <= text.length &&
    text.slice(start, end) === original
  );
}

function acceptedMistakes(text: string, mistakes: MistakeView[]) {
  const accepted: MistakeView[] = [];
  let lastEnd = 0;
  const sorted = mistakes
    .filter((mistake) => matchesText(text, mistake))
    .sort((a, b) => a.start - b.start);
  for (const mistake of sorted) {
    if (mistake.start >= lastEnd) {
      accepted.push(mistake);
      lastEnd = mistake.end;
    }
  }
  return accepted;
}

/** Offsets are UTF-16 code units of `text`; invalid, false and overlapping mistakes are left as plain text. */
export function buildSegments(
  text: string,
  mistakes: MistakeView[],
): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;
  for (const mistake of acceptedMistakes(text, mistakes)) {
    if (mistake.start > cursor) {
      segments.push({ kind: 'text', text: text.slice(cursor, mistake.start) });
    }
    segments.push({
      kind: 'mistake',
      text: text.slice(mistake.start, mistake.end),
      mistake,
    });
    cursor = mistake.end;
  }
  if (cursor < text.length || segments.length === 0) {
    segments.push({ kind: 'text', text: text.slice(cursor) });
  }
  return segments;
}
