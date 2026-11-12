import { Inject, Injectable, NotImplementedException } from '@nestjs/common';
import type { Plan } from '@gototalk/shared';
import { LANGUAGE_MODEL_PORT } from '../ports/language-model.port.js';
import type { LanguageModelPort } from '../ports/language-model.port.js';
import { LearnerModelService } from '../profile/learner-model.service.js';

export interface PlanSessionRequest {
  userId: string;
  /** Власна тема (`topic_source = custom`). */
  customTopic?: string;
}

/** Планувальник сесії. Скелет: реалізація в spec 03. */
@Injectable()
export class SessionPlannerService {
  constructor(
    @Inject(LANGUAGE_MODEL_PORT)
    protected readonly languageModel: LanguageModelPort,
    protected readonly learnerModel: LearnerModelService,
  ) {}

  /** Пропонує тему й 5 питань (рівень, сцени, цілі, топ-3 патерни → `LanguageModelPort.planSession`). */
  async planSession(request: PlanSessionRequest): Promise<Plan> {
    void request;
    throw new NotImplementedException(
      'SessionPlannerService.planSession: реалізація в spec 03 (docs/specs/03-session-start.md)',
    );
  }
}
