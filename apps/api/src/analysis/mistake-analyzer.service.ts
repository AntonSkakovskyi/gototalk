import { Inject, Injectable, NotImplementedException } from '@nestjs/common';
import type { AnalysisResult, Mistake } from '@gototalk/shared';
import { LANGUAGE_MODEL_PORT } from '../ports/language-model.port.js';
import type { LanguageModelPort } from '../ports/language-model.port.js';
import { LearnerModelService } from '../profile/learner-model.service.js';
import type { PatternGroup } from './mistake-pattern.types.js';

/** Аналіз реплік учня. Скелет: реалізація в spec 04. */
@Injectable()
export class MistakeAnalyzerService {
  constructor(
    @Inject(LANGUAGE_MODEL_PORT)
    protected readonly languageModel: LanguageModelPort,
    protected readonly learnerModel: LearnerModelService,
  ) {}

  /** Аналізує `text_verbatim`: виклик моделі, Zod-валідація, один повтор, відкидання невалідних позицій. */
  async analyzeUtterance(text: string): Promise<AnalysisResult> {
    void text;
    throw new NotImplementedException(
      'MistakeAnalyzerService.analyzeUtterance: реалізація в spec 04 (docs/specs/04-dialog.md)',
    );
  }

  /** Групує помилки за категоріями для оновлення `mistake_patterns` (spec 04, крок 6). */
  groupIntoPatterns(mistakes: Mistake[]): PatternGroup[] {
    void mistakes;
    throw new NotImplementedException(
      'MistakeAnalyzerService.groupIntoPatterns: реалізація в spec 04 (docs/specs/04-dialog.md)',
    );
  }
}
