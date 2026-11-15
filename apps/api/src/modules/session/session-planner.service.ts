import { Inject, Injectable, Logger } from '@nestjs/common';
import { PlanSchema } from '@gototalk/shared';
import type { Plan, PlanSessionRequest, SessionPlan } from '@gototalk/shared';
import { toLanguageModelHttpError } from '../../common/errors/language-model-http-errors.js';
import { LanguageModelUnavailableError } from '../../integrations/language-model/language-model.errors.js';
import { LANGUAGE_MODEL_PORT } from '../../integrations/language-model/language-model.port.js';
import type {
  LanguageModelPort,
  PlanSessionInput,
} from '../../integrations/language-model/language-model.port.js';
import { requestValidated } from '../../integrations/language-model/validated-call.js';
import { GoalsService } from '../profile/goals.service.js';
import { LearnerModelService } from '../profile/learner-model.service.js';
import { ProfileService } from '../profile/profile.service.js';
import { buildPlanInput } from './lib/plan-input.js';

const WEAK_AREAS_LIMIT = 3;

@Injectable()
export class SessionPlannerService {
  private readonly logger = new Logger(SessionPlannerService.name);

  constructor(
    @Inject(LANGUAGE_MODEL_PORT)
    private readonly languageModel: LanguageModelPort,
    private readonly profiles: ProfileService,
    private readonly goals: GoalsService,
    private readonly learnerModel: LearnerModelService,
  ) {}

  async plan(
    userId: string,
    request: PlanSessionRequest,
  ): Promise<SessionPlan> {
    const profile = await this.profiles.get(userId);
    const [goals, weakAreas] = await Promise.all([
      this.goals.listActive(userId),
      this.learnerModel.weakAreas(userId, WEAK_AREAS_LIMIT),
    ]);
    const input = buildPlanInput({ profile, goals, weakAreas, request });

    const modelPlan = await this.requestPlan(input);
    // The model is not trusted to repeat the topic the user typed
    if (request.customTopic === undefined) {
      return { ...modelPlan, topicSource: 'suggested' };
    }
    return {
      ...modelPlan,
      topic: request.customTopic,
      topicSource: 'custom',
    };
  }

  private async requestPlan(input: PlanSessionInput): Promise<Plan> {
    try {
      return await requestValidated(
        PlanSchema,
        () => this.languageModel.planSession(input),
        this.logger,
      );
    } catch (error) {
      if (error instanceof LanguageModelUnavailableError) {
        this.logger.warn('Language model unavailable');
      }
      throw toLanguageModelHttpError(error);
    }
  }
}
