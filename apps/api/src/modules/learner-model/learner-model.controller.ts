import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LearnerModelSchema } from '@gototalk/shared';
import type { LearnerModel } from '@gototalk/shared';
import { ApiZodResponse } from '../../common/swagger/api-zod.decorators.js';
import {
  CurrentUser,
  requireUserId,
} from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator.js';
import { LearnerModelService } from './learner-model.service.js';
import { toLearnerModel } from './learner-model.mapper.js';

const LEARNER_MODEL_WEAK_AREAS = 5;

@ApiTags('profile')
@ApiBearerAuth()
@Controller('profile')
export class LearnerModelController {
  constructor(private readonly learnerModel: LearnerModelService) {}

  @Get('learner-model')
  @ApiOperation({
    summary: 'Get the learner model',
    description: `The top ${LEARNER_MODEL_WEAK_AREAS} mistake patterns by frequency and the word counts per state; empty and zero for a new user.`,
  })
  @ApiZodResponse(LearnerModelSchema, {
    description:
      'LearnerModel { weakAreas: [{ category, frequency, lastSeenAt }], vocabulary: { new, partial, passive, active } }',
  })
  @ApiResponse({ status: 401, description: 'UNAUTHORIZED' })
  async getLearnerModel(
    @CurrentUser() user: AuthenticatedUser | undefined,
  ): Promise<LearnerModel> {
    return toLearnerModel(
      await this.learnerModel.snapshot(
        requireUserId(user),
        LEARNER_MODEL_WEAK_AREAS,
      ),
    );
  }
}
