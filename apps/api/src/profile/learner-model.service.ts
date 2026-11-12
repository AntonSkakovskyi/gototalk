import { Injectable, NotImplementedException } from '@nestjs/common';
import type {
  ApplyAnalysisInput,
  VocabularyStats,
  WeakArea,
} from './learner-model.types.js';

@Injectable()
export class LearnerModelService {
  async weakAreas(userId: string, limit = 3): Promise<WeakArea[]> {
    void userId;
    void limit;
    throw new NotImplementedException(
      'Not implemented: LearnerModelService.weakAreas (see docs/specs/02-profile.md)',
    );
  }

  async vocabularyStats(userId: string): Promise<VocabularyStats> {
    void userId;
    throw new NotImplementedException(
      'Not implemented: LearnerModelService.vocabularyStats (see docs/specs/02-profile.md)',
    );
  }

  async applyAnalysis(input: ApplyAnalysisInput): Promise<void> {
    void input;
    throw new NotImplementedException(
      'Not implemented: LearnerModelService.applyAnalysis (see docs/specs/04-dialog.md)',
    );
  }
}
