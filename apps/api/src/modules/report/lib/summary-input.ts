import type { SummarizeSessionInput } from '../../../integrations/language-model/language-model.port.js';
import type {
  CategoryCount,
  MistakeExample,
  SessionStats,
} from '../persistence/report.repository.js';

/** The caller passes the top categories only and examples already capped per category. */
export function buildSummaryInput(
  stats: SessionStats,
  categories: CategoryCount[],
  examples: Map<string, MistakeExample[]>,
): SummarizeSessionInput {
  return {
    answers: stats.answers,
    minutes: Math.max(1, Math.round(stats.durationSeconds / 60)),
    categories: categories.map((item) => ({
      code: item.category,
      title: item.titleUk,
      count: item.count,
      examples: examples.get(item.category) ?? [],
    })),
  };
}
