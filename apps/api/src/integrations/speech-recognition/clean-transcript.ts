const FILLER = /\s*,?\s*(?<!-)\b(?:um|uh|er)\b(?!-)\s*,?/gi;
const WELL_OPENER = /(^|[.?!]\s+)well,\s*(\S)/gi;

export function cleanTranscript(verbatim: string): string {
  const text = verbatim
    .replace(FILLER, ' ')
    .replace(/\s+([.?!,])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(
      WELL_OPENER,
      (_, lead: string, next: string) => lead + next.toUpperCase(),
    );
  return text.charAt(0).toUpperCase() + text.slice(1);
}
