const IRREGULAR_PAST: Record<string, string> = {
  go: 'went',
  see: 'saw',
  meet: 'met',
  buy: 'bought',
  make: 'made',
  take: 'took',
  do: 'did',
  have: 'had',
};

const BE_FORMS: Record<string, string> = {
  i: 'am',
  he: 'is',
  she: 'is',
  it: 'is',
  we: 'are',
  they: 'are',
};

export function pastTense(verb: string): string {
  const lower = verb.toLowerCase();
  const irregular = IRREGULAR_PAST[lower];
  if (irregular) return irregular;
  return lower.endsWith('e') ? `${lower}d` : `${lower}ed`;
}

export function thirdPerson(verb: string): string {
  const lower = verb.toLowerCase();
  if (lower === 'have') return 'has';
  if (/(?:o|s|sh|ch|x|z)$/.test(lower)) return `${lower}es`;
  if (/[^aeiou]y$/.test(lower)) return `${lower.slice(0, -1)}ies`;
  return `${verb}s`;
}

export function beForm(subject: string): string {
  return BE_FORMS[subject.toLowerCase()] ?? 'are';
}

export function matchCase(source: string, word: string): string {
  const first = source.charAt(0);
  const isUpper = first !== first.toLowerCase();
  return isUpper ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : word;
}
