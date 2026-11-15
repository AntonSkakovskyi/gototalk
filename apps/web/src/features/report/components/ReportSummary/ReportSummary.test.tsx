import type { SessionReport } from '@gototalk/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import uk from '@/shared/i18n/uk.json';
import { testReport } from '@/shared/testing/test-fixtures';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { ReportSummary } from './ReportSummary';

const text = uk.report.summary;

function renderSummary(
  overrides: Partial<SessionReport> = {},
  props: { retrying?: boolean; onRetry?: () => void } = {},
) {
  const onRetry = props.onRetry ?? vi.fn();
  renderWithProviders(
    <ReportSummary
      report={testReport(overrides)}
      retrying={props.retrying ?? false}
      onRetry={onRetry}
    />,
  );
  return { onRetry };
}

describe('ReportSummary', () => {
  it('[TC-05-07] shows the heading, the summary text and the stats', () => {
    renderSummary();

    expect(
      screen.getByRole('heading', { level: 2, name: text.title }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'You answered fluently, but past tenses need more practice.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(text.answersLabel)).toBeInTheDocument();
    expect(screen.getByText('5 відповідей')).toBeInTheDocument();
    expect(screen.getByText(text.durationLabel)).toBeInTheDocument();
    expect(screen.getByText('6 хвилин')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it.each([
    [1, '1 відповідь'],
    [2, '2 відповіді'],
    [5, '5 відповідей'],
    [11, '11 відповідей'],
    [21, '21 відповідь'],
  ])('[TC-05-07] writes %i answers as %s', (answers, label) => {
    renderSummary({ answers });

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it.each([
    [0, text.underMinute],
    [59, text.underMinute],
    [60, '1 хвилина'],
    [180, '3 хвилини'],
    [600, '10 хвилин'],
  ])('[TC-05-07] writes a %i s duration as %s', (durationSeconds, label) => {
    renderSummary({ durationSeconds });

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('[TC-05-07] lists only the top three categories with their counts in the given order', () => {
    renderSummary({
      categories: [
        { category: 'verb_tense', count: 4, theoryLinks: [] },
        { category: 'articles', count: 3, theoryLinks: [] },
        { category: 'word_order', count: 2, theoryLinks: [] },
        { category: 'prepositions', count: 1, theoryLinks: [] },
      ],
    });

    const items = within(
      screen.getByRole('list', { name: text.categoriesTitle }),
    ).getAllByRole('listitem');

    expect(items.map((item) => item.textContent)).toEqual([
      `${uk.mistakeCategories.verb_tense} – 4`,
      `${uk.mistakeCategories.articles} – 3`,
      `${uk.mistakeCategories.word_order} – 2`,
    ]);
    expect(
      screen.queryByText(new RegExp(uk.mistakeCategories.prepositions)),
    ).not.toBeInTheDocument();
  });

  it('[TC-05-07] says no mistakes were found when there are answers but no categories', () => {
    renderSummary({ categories: [] });

    expect(screen.getByText(text.noMistakes)).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('[TC-05-07] explains an unavailable summary, keeps the stats and categories and retries on demand', async () => {
    const user = userEvent.setup();
    const { onRetry } = renderSummary({ summary: { status: 'unavailable' } });

    expect(screen.getByText(text.unavailable)).toBeInTheDocument();
    expect(screen.getByText('5 відповідей')).toBeInTheDocument();
    expect(
      screen.getByText(`${uk.mistakeCategories.verb_tense} – 2`),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: uk.common.actions.retry }),
    );

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('[TC-05-07] disables the retry button while the report is refetching', () => {
    renderSummary({ summary: { status: 'unavailable' } }, { retrying: true });

    expect(
      screen.getByRole('button', { name: uk.common.actions.retry }),
    ).toBeDisabled();
  });

  it('[TC-05-07] says a session without answers had none and shows neither categories nor mistakes message', () => {
    renderSummary({
      answers: 0,
      durationSeconds: 20,
      summary: { status: 'no_answers' },
      categories: [],
    });

    expect(screen.getByText(text.noAnswers)).toBeInTheDocument();
    expect(screen.getByText(text.underMinute)).toBeInTheDocument();
    expect(screen.queryByText(text.noMistakes)).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
