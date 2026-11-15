import { screen, within } from '@testing-library/react';
import { uk } from '@/shared/i18n/resources';
import { testWord } from '@/shared/testing/fixtures/words';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { SessionWords } from './SessionWords';

const text = uk.vocabulary.session;

describe('SessionWords', () => {
  it('[TC-05-05] shows a titled list with the lemma, translation and marks of every word', () => {
    renderWithProviders(
      <SessionWords
        words={[
          testWord(),
          testWord({
            id: '4a8d3e27-1b5c-4c9d-9e6f-7a2b8c1d0002',
            lemma: 'budget',
            translationUk: 'бюджет',
            state: 'partial',
          }),
        ]}
      />,
    );

    expect(
      screen.getByRole('heading', { level: 2, name: text.title }),
    ).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    const first = within(items[0] as HTMLElement);
    expect(first.getByText('schedule')).toHaveAttribute('lang', 'en');
    expect(first.getByText('розклад')).toBeInTheDocument();
    expect(first.getByRole('radiogroup')).toBeInTheDocument();
    expect(
      within(items[1] as HTMLElement).getByRole('radio', {
        name: uk.vocabulary.marks.partial,
      }),
    ).toBeChecked();
  });

  it('[TC-05-05] shows only the lemma when the translation is missing', () => {
    renderWithProviders(
      <SessionWords words={[testWord({ translationUk: null })]} />,
    );

    const item = within(screen.getByRole('listitem'));
    expect(item.getByText('schedule')).toBeInTheDocument();
    expect(item.queryByText('null')).not.toBeInTheDocument();
    expect(item.queryByText('розклад')).not.toBeInTheDocument();
  });

  it('[TC-05-05] shows the empty message and no list when there are no words', () => {
    renderWithProviders(<SessionWords words={[]} />);

    expect(
      screen.getByRole('heading', { level: 2, name: text.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(text.empty)).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('[TC-05-05] shows an active word with a badge instead of controls', () => {
    renderWithProviders(
      <SessionWords words={[testWord({ state: 'active' })]} />,
    );

    expect(screen.getByText(uk.vocabulary.activeBadge)).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });
});
