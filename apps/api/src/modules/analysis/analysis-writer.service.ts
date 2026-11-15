import { Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import type { Mistake } from '../../integrations/language-model/model-output.js';
import type { DbTransaction } from '../../core/db/db.tokens.js';
import { mistakes, utterances } from '../../core/db/schema.js';
import { VocabularyWriter } from '../vocabulary/vocabulary-writer.service.js';
import { patternIncrements } from './lib/pattern-increments.js';
import type { AnalysisOutcome } from './mistake-analyzer.types.js';
import { PatternsRepository } from './persistence/patterns.repository.js';

@Injectable()
export class AnalysisWriter {
  constructor(
    private readonly patterns: PatternsRepository,
    private readonly vocabulary: VocabularyWriter,
  ) {}

  /** Only the call that claims the pending utterance writes mistakes, patterns and session words. */
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
      .returning({ sessionId: utterances.sessionId });
    const [row] = claimed;
    if (!row || outcome.status !== 'done') return;
    await this.saveMistakes(tx, userId, utteranceId, outcome.mistakes);
    await this.vocabulary.saveSessionWords(tx, {
      userId,
      sessionId: row.sessionId,
      better: outcome.better,
    });
  }

  private async saveMistakes(
    tx: DbTransaction,
    userId: string,
    utteranceId: string,
    found: Mistake[],
  ): Promise<void> {
    if (found.length === 0) return;
    const patternIds = await this.patterns.increment(
      tx,
      userId,
      patternIncrements(found),
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
