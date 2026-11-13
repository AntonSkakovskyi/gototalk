import { Inject, Injectable, NotImplementedException } from '@nestjs/common';
import type { Plan } from '@gototalk/shared';
import { LANGUAGE_MODEL_PORT } from '../integrations/language-model/language-model.port.js';
import type { LanguageModelPort } from '../integrations/language-model/language-model.port.js';
import { LearnerModelService } from '../profile/learner-model.service.js';

export interface PlanSessionRequest {
  userId: string;
  customTopic?: string;
}

@Injectable()
export class SessionPlannerService {
  constructor(
    @Inject(LANGUAGE_MODEL_PORT)
    protected readonly languageModel: LanguageModelPort,
    protected readonly learnerModel: LearnerModelService,
  ) {}

  async planSession(request: PlanSessionRequest): Promise<Plan> {
    void request;
    throw new NotImplementedException(
      'Not implemented: SessionPlannerService.planSession (see docs/specs/03-session-start.md)',
    );
  }
}
