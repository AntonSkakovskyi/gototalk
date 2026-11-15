import { describe, expect, it } from 'vitest';
import {
  REPORT_SUMMARY_MAX,
  ReportCategorySchema,
  ReportSummarySchema,
  SessionReportSchema,
  SUMMARY_EXAMPLES_PER_CATEGORY,
  TOP_CATEGORIES_LIMIT,
  TheoryLinkSchema,
} from '../index.js';

const sessionId = '4f5b0a52-2c1a-4f6a-8d0e-5a8f0a0b9c11';
const theory = {
  id: 'articles-basics',
  title: 'Articles',
  url: 'https://example.com/articles',
};
const category = { category: 'articles', count: 2, theoryLinks: [theory] };
const report = {
  sessionId,
  answers: 3,
  durationSeconds: 120,
  summary: { status: 'ready', text: 'Good job.' },
  categories: [category],
  words: [],
};

describe('report schemas', () => {
  it('[TC-05-01] the summary limit is 600 characters and the top is 3 categories', () => {
    expect([
      REPORT_SUMMARY_MAX,
      TOP_CATEGORIES_LIMIT,
      SUMMARY_EXAMPLES_PER_CATEGORY,
    ]).toEqual([600, 3, 2]);
  });

  it('[TC-05-01] ReportSummarySchema accepts the three statuses', () => {
    expect(ReportSummarySchema.parse({ status: 'ready', text: 'Ok' })).toEqual({
      status: 'ready',
      text: 'Ok',
    });
    expect(ReportSummarySchema.parse({ status: 'unavailable' })).toEqual({
      status: 'unavailable',
    });
    expect(ReportSummarySchema.parse({ status: 'no_answers' })).toEqual({
      status: 'no_answers',
    });
  });

  it('[TC-05-01] ReportSummarySchema rejects ready without text and an unknown status', () => {
    expect(ReportSummarySchema.safeParse({ status: 'ready' }).success).toBe(
      false,
    );
    expect(ReportSummarySchema.safeParse({ status: 'pending' }).success).toBe(
      false,
    );
  });

  it('[TC-05-01] TheoryLinkSchema requires id, title and url', () => {
    expect(TheoryLinkSchema.parse(theory)).toEqual(theory);
    expect(TheoryLinkSchema.safeParse({ id: 'a', title: 'b' }).success).toBe(
      false,
    );
  });

  it('[TC-05-01] ReportCategorySchema needs a known category and a count of at least 1', () => {
    expect(ReportCategorySchema.parse(category)).toEqual(category);
    expect(
      ReportCategorySchema.safeParse({ ...category, count: 0 }).success,
    ).toBe(false);
    expect(
      ReportCategorySchema.safeParse({ ...category, category: 'spelling' })
        .success,
    ).toBe(false);
    expect(
      ReportCategorySchema.safeParse({ ...category, theoryLinks: [] }).success,
    ).toBe(true);
  });

  it('[TC-05-01] SessionReportSchema accepts a valid report', () => {
    expect(SessionReportSchema.parse(report)).toEqual(report);
    expect(
      SessionReportSchema.safeParse({
        ...report,
        answers: 0,
        durationSeconds: 0,
        summary: { status: 'no_answers' },
        categories: [],
      }).success,
    ).toBe(true);
  });

  it('[TC-05-01] SessionReportSchema rejects negative numbers, a bad session id and a missing summary', () => {
    expect(
      SessionReportSchema.safeParse({ ...report, answers: -1 }).success,
    ).toBe(false);
    expect(
      SessionReportSchema.safeParse({ ...report, durationSeconds: 1.5 })
        .success,
    ).toBe(false);
    expect(
      SessionReportSchema.safeParse({ ...report, sessionId: 'x' }).success,
    ).toBe(false);
    expect(
      SessionReportSchema.safeParse({ ...report, summary: undefined }).success,
    ).toBe(false);
  });
});
