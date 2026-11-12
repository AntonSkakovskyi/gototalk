import { Injectable, NotImplementedException } from '@nestjs/common';
import type {
  ApplyAnalysisInput,
  VocabularyStats,
  WeakArea,
} from './learner-model.types.js';

/**
 * Модель учня: патерни помилок і словник зі станами.
 * Скелет: реалізація (доступ до БД) з'являється в specs 02 і 04.
 */
@Injectable()
export class LearnerModelService {
  /** Топ патернів помилок за частотою (spec 02: профіль, spec 03: вхід планувальника). */
  async weakAreas(userId: string, limit = 3): Promise<WeakArea[]> {
    void userId;
    void limit;
    throw new NotImplementedException(
      'LearnerModelService.weakAreas: реалізація в spec 02 (docs/specs/02-profile.md)',
    );
  }

  /** Кількість слів за станами (spec 02: екран профілю). */
  async vocabularyStats(userId: string): Promise<VocabularyStats> {
    void userId;
    throw new NotImplementedException(
      'LearnerModelService.vocabularyStats: реалізація в spec 02 (docs/specs/02-profile.md)',
    );
  }

  /** Оновлює патерни й стани слів за результатом аналізу репліки (spec 04, кроки 6 і 9). */
  async applyAnalysis(input: ApplyAnalysisInput): Promise<void> {
    void input;
    throw new NotImplementedException(
      'LearnerModelService.applyAnalysis: реалізація в spec 04 (docs/specs/04-dialog.md)',
    );
  }
}
