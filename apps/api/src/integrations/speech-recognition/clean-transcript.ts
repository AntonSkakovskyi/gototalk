const FILLER = /\s*,?\s*\b(?:um|uh|er)\b\s*,?/gi;
const WELL_OPENER = /\bwell,/gi;

export function cleanTranscript(verbatim: string): string {
  const text = verbatim
    .replace(FILLER, ' ')
    .replace(WELL_OPENER, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
