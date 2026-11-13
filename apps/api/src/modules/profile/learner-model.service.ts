import { Injectable, NotImplementedException } from '@nestjs/common';
import { LearnerModelRepository } from './persistence/learner-model.repository.js';
import type {
  ApplyAnalysisInput,
  LearnerModelSnapshot,
  VocabularyStats,
  WeakArea,
} from './learner-model.types.js';

@Injectable()
export class LearnerModelService {
  constructor(private readonly repository: LearnerModelRepository) {}

  weakAreas(userId: string, limit = 3): Promise<WeakArea[]> {
    return this.repository.weakAreas(userId, limit);
  }

  async vocabularyStats(userId: string): Promise<VocabularyStats> {
    const counts = await this.repository.wordStateCounts(userId);
    return {
      new: counts.new ?? 0,
      partial: counts.partial ?? 0,
      passive: counts.passive ?? 0,
      active: counts.active ?? 0,
    };
  }

  async snapshot(
    userId: string,
    weakAreasLimit: number,
  ): Promise<LearnerModelSnapshot> {
    const [weakAreas, vocabulary] = await Promise.all([
      this.weakAreas(userId, weakAreasLimit),
      this.vocabularyStats(userId),
    ]);
    return { weakAreas, vocabulary };
  }

  async applyAnalysis(input: ApplyAnalysisInput): Promise<void> {
    void input;
    throw new NotImplementedException(
      'Not implemented: LearnerModelService.applyAnalysis (see docs/specs/04-dialog.md)',
    );
  }
}
