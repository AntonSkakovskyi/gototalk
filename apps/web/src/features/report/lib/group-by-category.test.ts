import type {
  MistakeCategoryCode,
  TheoryLink,
  Utterance,
} from '@gototalk/shared';
import { testMistake, testUtterance } from '@/shared/testing/test-fixtures';
import { groupByCategory } from './group-by-category';

const TENSE_LINK: TheoryLink = {
  id: 'past-simple',
  title: 'Past Simple',
  url: 'https://example.com/theory/past-simple',
};

function answer(
  id: string,
  seq: number,
  categories: MistakeCategoryCode[],
  overrides: Partial<Utterance> = {},
) {
  return testUtterance({
    id,
    seq,
    role: 'user',
    text: `Answer ${id}`,
    analysisStatus: 'done',
    mistakes: categories.map((category, index) =>
      testMistake({
        id: `${id}-m${index}`,
        category,
      }),
    ),
    ...overrides,
  });
}

describe('groupByCategory', () => {
  it('[TC-05-06] returns no groups and no clean answers for an empty input', () => {
    expect(groupByCategory([], new Map())).toEqual({ groups: [], clean: [] });
  });

  it('[TC-05-06] groups answers by category and counts the remaining mistakes', () => {
    const first = answer('a1', 2, ['verb_tense', 'verb_tense']);
    const second = answer('a2', 4, ['verb_tense']);

    const { groups, clean } = groupByCategory(
      [first, second],
      new Map([['verb_tense', [TENSE_LINK]]]),
    );

    expect(clean).toEqual([]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      category: 'verb_tense',
      count: 3,
      theoryLinks: [TENSE_LINK],
    });
    expect(groups[0]?.answers.map(({ id }) => id)).toEqual(['a1', 'a2']);
  });

  it('[TC-05-06] orders groups by count descending, then by category code', () => {
    const { groups } = groupByCategory(
      [
        answer('a1', 2, ['word_order', 'articles', 'verb_tense']),
        answer('a2', 4, ['verb_tense', 'prepositions']),
      ],
      new Map(),
    );

    expect(groups.map(({ category, count }) => [category, count])).toEqual([
      ['verb_tense', 2],
      ['articles', 1],
      ['prepositions', 1],
      ['word_order', 1],
    ]);
  });

  it('[TC-05-03] ignores mistakes marked as not a mistake and drops emptied groups', () => {
    const marked = testUtterance({
      id: 'a1',
      seq: 2,
      role: 'user',
      analysisStatus: 'done',
      mistakes: [
        testMistake({ id: 'm1', category: 'articles', isFalse: true }),
        testMistake({ id: 'm2', category: 'verb_tense' }),
      ],
    });

    const { groups, clean } = groupByCategory([marked], new Map());

    expect(groups.map(({ category }) => category)).toEqual(['verb_tense']);
    expect(clean).toEqual([]);
  });

  it('[TC-05-03] moves an answer whose mistakes are all false to the clean list', () => {
    const marked = answer('a1', 2, ['articles']);
    const onlyFalse = {
      ...marked,
      mistakes: marked.mistakes.map((mistake) => ({
        ...mistake,
        isFalse: true,
      })),
    };

    const { groups, clean } = groupByCategory([onlyFalse], new Map());

    expect(groups).toEqual([]);
    expect(clean).toEqual([onlyFalse]);
  });

  it('[TC-05-06] puts an answer with two categories into both groups with only that category mistakes', () => {
    const both = answer('a1', 2, ['articles', 'verb_tense', 'verb_tense']);

    const { groups } = groupByCategory([both], new Map());

    expect(groups.map(({ category }) => category)).toEqual([
      'verb_tense',
      'articles',
    ]);
    expect(
      groups[0]?.answers[0]?.mistakes.map(({ category }) => category),
    ).toEqual(['verb_tense', 'verb_tense']);
    expect(
      groups[1]?.answers[0]?.mistakes.map(({ category }) => category),
    ).toEqual(['articles']);
  });

  it('[TC-05-06] keeps the better phrasings only in the first group the answer appears in', () => {
    const better = [{ original: 'I go', better: 'I went' }];
    const both = answer('a1', 2, ['articles', 'verb_tense', 'verb_tense'], {
      better,
    });

    const { groups } = groupByCategory([both], new Map());

    expect(groups[0]?.answers[0]?.better).toEqual(better);
    expect(groups[1]?.answers[0]?.better).toEqual([]);
  });

  it('[TC-05-06] uses the theory links of the category and an empty list when there are none', () => {
    const { groups } = groupByCategory(
      [answer('a1', 2, ['verb_tense', 'articles'])],
      new Map([['verb_tense', [TENSE_LINK]]]),
    );

    expect(groups[0]?.category).toBe('articles');
    expect(groups[0]?.theoryLinks).toEqual([]);
    expect(groups[1]?.theoryLinks).toEqual([TENSE_LINK]);
  });

  it('[TC-05-06] ignores assistant utterances and keeps the clean answers in seq order', () => {
    const question = testUtterance({ id: 'q1', seq: 1 });
    const clean = answer('a2', 5, []);
    const pending = answer('a1', 3, [], { analysisStatus: 'pending' });

    const result = groupByCategory([clean, question, pending], new Map());

    expect(result.groups).toEqual([]);
    expect(result.clean.map(({ id }) => id)).toEqual(['a1', 'a2']);
  });

  it('[TC-05-06] treats a failed analysis as a clean answer even if it carries mistakes', () => {
    const failed = answer('a1', 2, ['articles'], { analysisStatus: 'failed' });

    const { groups, clean } = groupByCategory([failed], new Map());

    expect(groups).toEqual([]);
    expect(clean).toEqual([failed]);
  });
});
