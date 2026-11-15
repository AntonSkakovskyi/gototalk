import { Body, Controller, Get, Put } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  LEVELS,
  MAX_SCENE_LENGTH,
  MAX_SCENES,
  UpdateProfileRequestSchema,
} from '@gototalk/shared';
import type {
  LearnerModel,
  Profile,
  UpdateProfileRequest,
} from '@gototalk/shared';
import {
  CurrentUser,
  requireUserId,
} from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator.js';
import { ZodBodyPipe } from '../../common/pipes/zod-body.pipe.js';
import { LearnerModelService } from './learner-model.service.js';
import { toLearnerModel } from './learner-model.mapper.js';
import { ProfileService } from './profile.service.js';

const LEARNER_MODEL_WEAK_AREAS = 5;

@ApiTags('profile')
@ApiBearerAuth()
@Controller('profile')
export class ProfileController {
  constructor(
    private readonly profile: ProfileService,
    private readonly learnerModel: LearnerModelService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get the learner profile' })
  @ApiResponse({
    status: 200,
    description: 'Profile { level, scenes, updatedAt }',
  })
  @ApiResponse({ status: 401, description: 'UNAUTHORIZED' })
  @ApiResponse({
    status: 404,
    description: 'PROFILE_NOT_FOUND: onboarding is not finished',
  })
  get(@CurrentUser() user: AuthenticatedUser | undefined): Promise<Profile> {
    return this.profile.get(requireUserId(user));
  }

  @Put()
  @ApiOperation({
    summary: 'Create or replace the learner profile',
    description:
      'Upsert: creates the profile when missing, otherwise replaces level and scenes and moves updatedAt.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['level', 'scenes'],
      properties: {
        level: { type: 'string', enum: [...LEVELS] },
        scenes: {
          type: 'array',
          minItems: 1,
          maxItems: MAX_SCENES,
          uniqueItems: true,
          items: { type: 'string', minLength: 1, maxLength: MAX_SCENE_LENGTH },
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'The saved Profile' })
  @ApiResponse({ status: 400, description: 'VALIDATION_ERROR' })
  @ApiResponse({ status: 401, description: 'UNAUTHORIZED' })
  update(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body(new ZodBodyPipe(UpdateProfileRequestSchema))
    body: UpdateProfileRequest,
  ): Promise<Profile> {
    return this.profile.update(requireUserId(user), body);
  }

  @Get('learner-model')
  @ApiOperation({
    summary: 'Get the learner model',
    description: `The top ${LEARNER_MODEL_WEAK_AREAS} mistake patterns by frequency and the word counts per state; empty and zero for a new user.`,
  })
  @ApiResponse({
    status: 200,
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
