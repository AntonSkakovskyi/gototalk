import { screen, within } from '@testing-library/react';
import type { CategoryGroupData } from '@/features/report/lib/group-by-category';
import uk from '@/shared/i18n/uk.json';
import {
  testMistake,
  testSession,
  testUtterance,
} from '@/shared/testing/test-fixtures';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { CategoryGroup } from './CategoryGroup';

const QUESTION = testUtterance({ id: 'q1', seq: 1, text: 'Why?' });
const ANSWER = testUtterance({
  id: 'a1',
  seq: 2,
  role: 'user',
  text: 'I go home',
  analysisStatus: 'done',
  mistakes: [testMistake()],
});

function group(overrides: Partial<CategoryGroupData> = {}): CategoryGroupData {
  return {
    category: 'verb_tense',
    count: 1,
    theoryLinks: [],
    answers: [ANSWER],
    ...overrides,
  };
}

function renderGroup(data: CategoryGroupData) {
  return renderWithProviders(
    <CategoryGroup
      sessionId={testSession().id}
      group={data}
      questions={new Map([[ANSWER.id, QUESTION]])}
    />,
  );
}

describe('CategoryGroup', () => {
  it('[TC-05-06] names the region by the category title and the count', () => {
    renderGroup(group());

    const title = `${uk.mistakeCategories.verb_tense} – 1`;
    const region = screen.getByRole('region', { name: title });
    expect(within(region).getByRole('heading', { level: 3 })).toHaveTextContent(
      title,
    );
  });

  it('[TC-05-06] shows the question before the highlighted answer', () => {
    renderGroup(group());

    const item = screen.getByRole('listitem');
    expect(item).toHaveTextContent('Why?');
    expect(
      within(item).getByRole('button', { name: 'go' }),
    ).toBeInTheDocument();
  });

  it('[TC-05-06] lists several theory links and omits the block when there are none', () => {
    const { unmount } = renderGroup(
      group({
        theoryLinks: [
          { id: 'a', title: 'Past Simple', url: 'https://example.com/a' },
          { id: 'b', title: 'Present Perfect', url: 'https://example.com/b' },
        ],
      }),
    );

    expect(screen.getAllByRole('link')).toHaveLength(2);
    expect(screen.getByText(uk.report.deep.theoryTitle)).toBeInTheDocument();
    unmount();

    renderGroup(group());
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(
      screen.queryByText(uk.report.deep.theoryTitle),
    ).not.toBeInTheDocument();
  });
});
