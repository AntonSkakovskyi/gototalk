import { Inject, Injectable, NotImplementedException } from '@nestjs/common';
import type { AnalysisResult, Mistake } from '@gototalk/shared';
import { LANGUAGE_MODEL_PORT } from '../ports/language-model.port.js';
import type { LanguageModelPort } from '../ports/language-model.port.js';
import { LearnerModelService } from '../profile/learner-model.service.js';
import type { PatternGroup } from './mistake-pattern.types.js';

@Injectable()
export class MistakeAnalyzerService {
  constructor(
    @Inject(LANGUAGE_MODEL_PORT)
    protected readonly languageModel: LanguageModelPort,
    protected readonly learnerModel: LearnerModelService,
  ) {}

  async analyzeUtterance(text: string): Promise<AnalysisResult> {
    void text;
    throw new NotImplementedException(
      'Not implemented: MistakeAnalyzerService.analyzeUtterance (see docs/specs/04-dialog.md)',
    );
  }

  groupIntoPatterns(mistakes: Mistake[]): PatternGroup[] {
    void mistakes;
    throw new NotImplementedException(
      'Not implemented: MistakeAnalyzerService.groupIntoPatterns (see docs/specs/04-dialog.md)',
    );
  }
}
