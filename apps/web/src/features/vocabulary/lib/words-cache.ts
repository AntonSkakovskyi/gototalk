import type { SessionReport, Word, WordPage } from '@gototalk/shared';
import type { InfiniteData } from '@tanstack/react-query';

function hasWord(words: Word[], id: string): boolean {
  return words.some((word) => word.id === id);
}

function replaceWord(words: Word[], updated: Word): Word[] {
  return words.map((word) => (word.id === updated.id ? updated : word));
}

export function withWordInReport(
  report: SessionReport,
  updated: Word,
): SessionReport {
  if (!hasWord(report.words, updated.id)) {
    return report;
  }
  return { ...report, words: replaceWord(report.words, updated) };
}

export function withWordInPages(
  data: InfiniteData<WordPage>,
  updated: Word,
): InfiniteData<WordPage> {
  if (!data.pages.some((page) => hasWord(page.items, updated.id))) {
    return data;
  }
  return {
    ...data,
    pages: data.pages.map((page) =>
      hasWord(page.items, updated.id)
        ? { ...page, items: replaceWord(page.items, updated) }
        : page,
    ),
  };
}
