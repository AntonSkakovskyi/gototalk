import { testReport } from '@/shared/testing/fixtures/report';
import { testWord } from '@/shared/testing/fixtures/words';
import { withWordInPages, withWordInReport } from './words-cache';

const OTHER = testWord({ id: '4a8d3e27-1b5c-4c9d-9e6f-7a2b8c1d0009' });

describe('words cache helpers', () => {
  it('[TC-05-05] replaces the word in the report and keeps the others', () => {
    const report = testReport({ words: [testWord(), OTHER] });
    const updated = testWord({ state: 'passive' });

    expect(withWordInReport(report, updated).words).toEqual([updated, OTHER]);
  });

  it('[TC-05-05] returns the same report when it has no such word', () => {
    const report = testReport({ words: [OTHER] });

    expect(withWordInReport(report, testWord({ state: 'passive' }))).toBe(
      report,
    );
  });

  it('[TC-05-05] replaces the word in the cached pages', () => {
    const data = {
      pages: [
        { items: [OTHER], nextCursor: 'c1' },
        { items: [testWord()], nextCursor: null },
      ],
      pageParams: [null, 'c1'],
    };
    const updated = testWord({ state: 'partial' });

    const result = withWordInPages(data, updated);

    expect(result.pages[1]?.items).toEqual([updated]);
    expect(result.pages[0]).toBe(data.pages[0]);
  });

  it('[TC-05-05] returns the same pages when the word is not cached', () => {
    const data = {
      pages: [{ items: [OTHER], nextCursor: null }],
      pageParams: [null],
    };

    expect(withWordInPages(data, testWord({ state: 'passive' }))).toBe(data);
  });
});
