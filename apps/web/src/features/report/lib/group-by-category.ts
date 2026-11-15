import type {
  MistakeCategoryCode,
  TheoryLink,
  Utterance,
} from '@gototalk/shared';

export interface CategoryGroupData {
  category: MistakeCategoryCode;
  count: number;
  theoryLinks: TheoryLink[];
  answers: Utterance[];
}

export interface GroupedAnswers {
  groups: CategoryGroupData[];
  clean: Utterance[];
}

export function groupByCategory(
  utterances: Utterance[],
  theory: ReadonlyMap<MistakeCategoryCode, TheoryLink[]>,
): GroupedAnswers {
  const answers = utterances
    .filter(({ role }) => role === 'user')
    .toSorted((first, second) => first.seq - second.seq);
  const byCategory = new Map<MistakeCategoryCode, Utterance[]>();
  const clean: Utterance[] = [];

  for (const answer of answers) {
    const mistakes =
      answer.analysisStatus === 'done'
        ? answer.mistakes.filter(({ isFalse }) => !isFalse)
        : [];
    if (mistakes.length === 0) {
      clean.push(answer);
      continue;
    }
    for (const category of new Set(mistakes.map((m) => m.category))) {
      const own = mistakes.filter((m) => m.category === category);
      byCategory.set(category, [
        ...(byCategory.get(category) ?? []),
        { ...answer, mistakes: own },
      ]);
    }
  }

  const groups = [...byCategory.entries()]
    .map(([category, items]) => ({
      category,
      count: items.reduce((total, item) => total + item.mistakes.length, 0),
      theoryLinks: theory.get(category) ?? [],
      answers: items,
    }))
    .toSorted(
      (first, second) =>
        second.count - first.count ||
        first.category.localeCompare(second.category),
    );

  const placed = new Set<string>();
  for (const group of groups) {
    group.answers = group.answers.map((item) => {
      const first = !placed.has(item.id);
      placed.add(item.id);
      return first ? item : { ...item, better: [] };
    });
  }

  return { groups, clean };
}
