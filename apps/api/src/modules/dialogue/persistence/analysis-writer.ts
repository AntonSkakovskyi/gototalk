import { Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import type { Mistake } from '@gototalk/shared';
import type { DbTransaction } from '../../../core/db/db.tokens.js';
import {
  mistakePatterns,
  mistakes,
  utterances,
} from '../../../core/db/schema.js';
import { patternIncrements } from '../../analysis/lib/pattern-increments.js';
import type { AnalysisOutcome } from '../../analysis/mistake-analyzer.types.js';

@Injectable()
export class AnalysisWriter {
  /** Claims the pending utterance; the mistakes and pattern increments are written only by the call that claimed it. */
  async save(
    tx: DbTransaction,
    userId: string,
    utteranceId: string,
    outcome: AnalysisOutcome,
  ): Promise<void> {
    const claimed = await tx
      .update(utterances)
      .set({
        analysisStatus: outcome.status,
        betterPhrasings: outcome.status === 'done' ? outcome.better : [],
        analysisPromptVersion: outcome.promptVersion,
        analysisModel: outcome.model,
        analyzedAt: sql`clock_timestamp()`,
      })
      .where(
        and(
          eq(utterances.id, utteranceId),
          eq(utterances.analysisStatus, 'pending'),
        ),
      )
      .returning({ id: utterances.id });
    if (claimed.length === 0 || outcome.status !== 'done') return;
    await this.saveMistakes(tx, userId, utteranceId, outcome.mistakes);
  }

  private async saveMistakes(
    tx: DbTransaction,
    userId: string,
    utteranceId: string,
    found: Mistake[],
  ): Promise<void> {
    // Fixed category order keeps row locks consistent across concurrent transactions of one user
    const increments = patternIncrements(found).sort((a, b) =>
      a.category.localeCompare(b.category),
    );
    if (increments.length === 0) return;
    const patterns = await tx
      .insert(mistakePatterns)
      .values(
        increments.map(({ category, count }) => ({
          userId,
          category,
          frequency: count,
          lastSeenAt: sql`clock_timestamp()`,
        })),
      )
      .onConflictDoUpdate({
        target: [mistakePatterns.userId, mistakePatterns.category],
        set: {
          frequency: sql`${mistakePatterns.frequency} + excluded.frequency`,
          lastSeenAt: sql`clock_timestamp()`,
        },
      })
      .returning({
        id: mistakePatterns.id,
        category: mistakePatterns.category,
      });
    const patternIds = new Map(
      patterns.map(({ id, category }) => [category, id]),
    );
    await tx.insert(mistakes).values(
      found.map((mistake) => ({
        utteranceId,
        patternId: patternIds.get(mistake.category) ?? null,
        original: mistake.original,
        suggestion: mistake.suggestion,
        explanationEn: mistake.explanation_en,
        translationUk: mistake.translation_uk,
        category: mistake.category,
        startPos: mistake.start,
        endPos: mistake.end,
      })),
    );
  }
}
