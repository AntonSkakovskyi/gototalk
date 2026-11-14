const TOKEN = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;
const MAX_NGRAM = 4;

export function tokenize(text: string): string[] {
  return (text.match(TOKEN) ?? []).map((token) =>
    token.toLowerCase().replaceAll('’', "'"),
  );
}

export function usageCandidates(textClean: string): string[] {
  const tokens = tokenize(textClean);
  const candidates = new Set<string>();
  for (let size = 1; size <= MAX_NGRAM; size += 1) {
    for (let start = 0; start + size <= tokens.length; start += 1) {
      candidates.add(tokens.slice(start, start + size).join(' '));
    }
  }
  return [...candidates];
}
