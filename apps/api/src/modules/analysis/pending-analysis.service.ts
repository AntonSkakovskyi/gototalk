import { Inject, Injectable, Logger } from '@nestjs/common';
import { LanguageModelUnavailableError } from '../../integrations/language-model/language-model.errors.js';
import { MistakeAnalyzerService } from './mistake-analyzer.service.js';
import type { AnalysisOutcome } from './mistake-analyzer.types.js';
import { PendingAnalysisRepository } from './persistence/pending-analysis.repository.js';

@Injectable()
export class PendingAnalysisService {
  private readonly logger = new Logger(PendingAnalysisService.name);

  constructor(
    @Inject(PendingAnalysisRepository)
    private readonly pending: Pick<
      PendingAnalysisRepository,
      'findPending' | 'save'
    >,
    @Inject(MistakeAnalyzerService)
    private readonly analyzer: Pick<MistakeAnalyzerService, 'analyze'>,
  ) {}

  /** Analyses the user's pending answers of the session; true when none is left pending afterwards. */
  async complete(userId: string, sessionId: string): Promise<boolean> {
    const pending = await this.pending.findPending(userId, sessionId);
    for (const { id, text } of pending) {
      const outcome = await this.analyze(text);
      if (outcome === null) return false;
      const stored = await this.pending.save(userId, sessionId, id, outcome);
      // save() is false only when the session is gone: nothing is left to analyse
      if (!stored) return true;
    }
    return true;
  }

  // The model call stays outside any transaction
  private async analyze(text: string): Promise<AnalysisOutcome | null> {
    try {
      return await this.analyzer.analyze(text);
    } catch (error) {
      if (!(error instanceof LanguageModelUnavailableError)) throw error;
      this.logger.warn('Language model unavailable, analyses left pending');
      return null;
    }
  }
}
