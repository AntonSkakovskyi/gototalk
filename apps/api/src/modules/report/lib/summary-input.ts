import { TOP_CATEGORIES_LIMIT } from '@gototalk/shared';
import type { SummarizeSessionInput } from '../../../integrations/language-model/language-model.port.js';
import type {
  CategoryCount,
  MistakeExample,
  SessionStats,
} from '../persistence/report.repository.js';

const EXAMPLES_LIMIT = 2;

export function buildSummaryInput(
  stats: SessionStats,
  categories: CategoryCount[],
  examples: Map<string, MistakeExample[]>,
): SummarizeSessionInput {
  return {
    answers: stats.answers,
    minutes: Math.max(1, Math.round(stats.durationSeconds / 60)),
    categories: categories.slice(0, TOP_CATEGORIES_LIMIT).map((item) => ({
      code: item.category,
      title: item.titleUk,
      count: item.count,
      examples: (examples.get(item.category) ?? []).slice(0, EXAMPLES_LIMIT),
    })),
  };
}
