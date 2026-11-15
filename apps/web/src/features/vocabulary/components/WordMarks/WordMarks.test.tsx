import { ERROR_CODES, type Word } from '@gototalk/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import uk from '@/shared/i18n/uk.json';
import { errorResponse } from '@/shared/testing/http-responses';
import { testWord } from '@/shared/testing/fixtures/words';
import { renderWithWords } from '@/features/vocabulary/testing/words-harness';
import { WordMarks } from './WordMarks';

const marks = uk.vocabulary.marks;
const WORD = testWord();

function renderMarks(
  word: Word = WORD,
  mark?: Parameters<typeof renderWithWords>[2],
) {
  return renderWithWords(
    [word],
    (words) => (
      <>
        {words.map((item) => (
          <WordMarks key={item.id} word={item} />
        ))}
      </>
    ),
    mark,
  );
}

const radio = (name: string) => screen.findByRole('radio', { name });

describe('WordMarks', () => {
  it('[TC-05-05] shows the three marks in order with the current state selected', async () => {
    renderMarks(testWord({ state: 'partial' }));

    await radio(marks.new);
    const radios = screen.getAllByRole<HTMLInputElement>('radio');

    expect(radios.map((item) => item.labels?.[0]?.textContent)).toEqual([
      marks.new,
      marks.partial,
      marks.passive,
    ]);
    expect(radios.map((item) => item.checked)).toEqual([false, true, false]);
  });

  it('[TC-05-05] names the radio group after the lemma', async () => {
    renderMarks();

    expect(
      await screen.findByRole('radiogroup', {
        name: marks.groupLabel.replace('{{lemma}}', WORD.lemma),
      }),
    ).toBeInTheDocument();
  });

  it('[TC-05-05] sends one PATCH per tap and reflects each new state after the response', async () => {
    const user = userEvent.setup();
    const api = renderMarks();

    await user.click(await radio(marks.partial));
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: marks.partial })).toBeChecked(),
    );

    await user.click(screen.getByRole('radio', { name: marks.passive }));
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: marks.passive })).toBeChecked(),
    );

    await user.click(screen.getByRole('radio', { name: marks.new }));
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: marks.new })).toBeChecked(),
    );

    expect(api.markRequests()).toEqual([
      { id: WORD.id, body: { state: 'partial' } },
      { id: WORD.id, body: { state: 'passive' } },
      { id: WORD.id, body: { state: 'new' } },
    ]);
  });

  it('[TC-05-03] sends nothing when the selected mark is tapped again', async () => {
    const user = userEvent.setup();
    const api = renderMarks();

    await user.click(await radio(marks.new));

    expect(api.markRequests()).toEqual([]);
    expect(screen.getByRole('radio', { name: marks.new })).toBeChecked();
  });

  it('[TC-05-05] updates the cached report and requests a refetch of it', async () => {
    const user = userEvent.setup();
    const api = renderMarks();

    await user.click(await radio(marks.passive));

    await waitFor(() => expect(api.reportRequests()).toHaveLength(2));
    expect(screen.getByRole('radio', { name: marks.passive })).toBeChecked();
  });

  it('[TC-05-05] ignores taps and flags the group as busy while the request is pending', async () => {
    const user = userEvent.setup();
    let release: (response: Response) => void = () => undefined;
    const api = renderMarks(
      WORD,
      () =>
        new Promise<Response>((done) => {
          release = done;
        }),
    );

    await user.click(await radio(marks.partial));
    const group = screen.getByRole('radiogroup');
    await waitFor(() => expect(group).toHaveAttribute('aria-busy', 'true'));
    await user.click(screen.getByRole('radio', { name: marks.passive }));

    expect(api.markRequests()).toHaveLength(1);
    expect(screen.getByRole('radio', { name: marks.passive })).toBeEnabled();
    expect(screen.getByRole('radio', { name: marks.new })).toBeChecked();

    release(new Response(JSON.stringify({ ...WORD, state: 'partial' })));
    await waitFor(() => expect(group).toHaveAttribute('aria-busy', 'false'));
    expect(api.markRequests()).toHaveLength(1);
  });

  it('[TC-05-05] keeps the keyboard focus inside the group while the mark is saved', async () => {
    const user = userEvent.setup();
    const api = renderMarks();

    (await radio(marks.new)).focus();
    await user.keyboard('{ArrowRight}');

    const group = screen.getByRole('radiogroup');
    expect(group).toContainElement(document.activeElement as HTMLElement);
    await waitFor(() => expect(api.reportRequests()).toHaveLength(2));
    await waitFor(() => expect(group).toHaveAttribute('aria-busy', 'false'));
    expect(group).toContainElement(document.activeElement as HTMLElement);
    expect(document.activeElement).not.toBe(document.body);
  });

  it.each([
    [404, ERROR_CODES.WORD_NOT_FOUND, uk.vocabulary.errors.notFound],
    [409, ERROR_CODES.WORD_ALREADY_ACTIVE, uk.vocabulary.errors.alreadyActive],
    [500, 'INTERNAL_ERROR', uk.errors.generic],
  ])(
    '[TC-05-05] shows the localized message for %i and keeps the previous selection',
    async (status, code, message) => {
      const user = userEvent.setup();
      renderMarks(WORD, () => errorResponse(status, code));

      await user.click(await radio(marks.passive));

      const text = await screen.findByText(message);
      expect(text.closest('[aria-live="polite"]')).not.toBeNull();
      expect(screen.getByRole('radio', { name: marks.new })).toBeChecked();
      expect(screen.getByRole('radio', { name: marks.passive })).toBeEnabled();
    },
  );

  it('[TC-05-05] shows a badge and no controls for an active word', async () => {
    renderMarks(testWord({ state: 'active' }));

    expect(
      await screen.findByText(uk.vocabulary.activeBadge),
    ).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  it('[TC-05-05] selects a mark with the arrow keys', async () => {
    const user = userEvent.setup();
    const api = renderMarks();

    (await radio(marks.new)).focus();
    await user.keyboard('{ArrowRight}');

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: marks.partial })).toBeChecked(),
    );
    expect(api.markRequests()).toEqual([
      { id: WORD.id, body: { state: 'partial' } },
    ]);
  });

  it('[TC-05-05] selects the focused mark with Space', async () => {
    const user = userEvent.setup();
    const api = renderMarks();

    (await radio(marks.passive)).focus();
    await user.keyboard(' ');

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: marks.passive })).toBeChecked(),
    );
    expect(api.markRequests()).toEqual([
      { id: WORD.id, body: { state: 'passive' } },
    ]);
  });
});
