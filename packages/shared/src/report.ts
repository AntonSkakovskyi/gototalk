import { z } from 'zod';
import { MistakeCategoryCodeSchema } from './mistake-categories.js';
import { WordSchema } from './words.js';

export const REPORT_SUMMARY_MAX = 600;

export const TOP_CATEGORIES_LIMIT = 3;

export const ReportSummarySchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ready'), text: z.string().min(1).max(REPORT_SUMMARY_MAX) }),
  z.object({ status: z.literal('unavailable') }),
  z.object({ status: z.literal('no_answers') }),
]);

export const TheoryLinkSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
});

export const ReportCategorySchema = z.object({
  category: MistakeCategoryCodeSchema,
  count: z.int().min(1),
  theoryLinks: z.array(TheoryLinkSchema),
});

export const SessionReportSchema = z.object({
  sessionId: z.uuid(),
  answers: z.int().min(0),
  durationSeconds: z.int().min(0),
  summary: ReportSummarySchema,
  /** Ordered by count DESC then category ASC, excludes is_false; the top ones are the first TOP_CATEGORIES_LIMIT. */
  categories: z.array(ReportCategorySchema),
  words: z.array(WordSchema),
});

export type ReportSummary = z.infer<typeof ReportSummarySchema>;
export type TheoryLink = z.infer<typeof TheoryLinkSchema>;
export type ReportCategory = z.infer<typeof ReportCategorySchema>;
export type SessionReport = z.infer<typeof SessionReportSchema>;
