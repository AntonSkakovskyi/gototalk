import { Inject, Injectable, Logger } from '@nestjs/common';
import { TOP_CATEGORIES_LIMIT } from '@gototalk/shared';
import { SummarySchema } from '../../integrations/language-model/model-output.js';
import type { ReportSummary } from '@gototalk/shared';
import {
  LanguageModelInvalidResponseError,
  LanguageModelUnavailableError,
} from '../../integrations/language-model/language-model.errors.js';
import { LANGUAGE_MODEL_PORT } from '../../integrations/language-model/language-model.port.js';
import type {
  LanguageModelPort,
  SummarizeSessionInput,
} from '../../integrations/language-model/language-model.port.js';
import { requestValidated } from '../../integrations/language-model/validated-call.js';
import { PendingAnalysisService } from '../analysis/pending-analysis.service.js';
import { buildSummaryInput } from './lib/summary-input.js';
import { ReportRepository } from './persistence/report.repository.js';
import type { SummaryToSave } from './persistence/report.repository.js';

@Injectable()
export class ReportGeneratorService {
  private readonly logger = new Logger(ReportGeneratorService.name);

  constructor(
    @Inject(ReportRepository)
    private readonly repository: Pick<
      ReportRepository,
      'findStoredSummary' | 'stats' | 'categories' | 'examples' | 'saveSummary'
    >,
    @Inject(PendingAnalysisService)
    private readonly pending: Pick<PendingAnalysisService, 'complete'>,
    @Inject(LANGUAGE_MODEL_PORT)
    private readonly languageModel: Pick<LanguageModelPort, 'summarizeSession'>,
  ) {}

  /** The caller guarantees the session belongs to the user and is finished. Generates the summary once and stores it. */
  async ensure(userId: string, sessionId: string): Promise<ReportSummary> {
    const existing = await this.repository.findStoredSummary(userId, sessionId);
    if (existing) return { status: 'ready', text: existing.summary };

    const stats = await this.repository.stats(userId, sessionId);
    if (stats.answers === 0) return { status: 'no_answers' };

    if (!(await this.pending.complete(userId, sessionId))) {
      return { status: 'unavailable' };
    }

    const top = (await this.repository.categories(userId, sessionId)).slice(
      0,
      TOP_CATEGORIES_LIMIT,
    );
    const examples = await this.repository.examples(
      userId,
      sessionId,
      top.map((item) => item.category),
    );
    const generated = await this.generate(
      buildSummaryInput(stats, top, examples),
    );
    if (generated === null) return { status: 'unavailable' };

    await this.repository.saveSummary(userId, sessionId, generated);
    const stored = await this.repository.findStoredSummary(userId, sessionId);
    if (!stored) return { status: 'unavailable' };
    return { status: 'ready', text: stored.summary };
  }

  // The model call stays outside any transaction
  private async generate(
    input: SummarizeSessionInput,
  ): Promise<SummaryToSave | null> {
    let promptVersion = '';
    let model = '';
    const call = async (): Promise<unknown> => {
      const response = await this.languageModel.summarizeSession(input);
      promptVersion = response.promptVersion;
      model = response.model;
      return response.output;
    };
    try {
      const { summary } = await requestValidated(
        SummarySchema,
        call,
        this.logger,
      );
      return { summary, promptVersion, model };
    } catch (error) {
      if (!(
        error instanceof LanguageModelUnavailableError ||
        error instanceof LanguageModelInvalidResponseError
      )) {
        throw error;
      }
      this.logger.warn('Session summary unavailable, nothing saved');
      return null;
    }
  }
}
