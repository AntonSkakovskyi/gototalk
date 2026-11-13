import { Body, Controller, Get, Put } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LEVELS, UpdateProfileRequestSchema } from '@gototalk/shared';
import type { Profile, UpdateProfileRequest } from '@gototalk/shared';
import {
  CurrentUser,
  requireUserId,
} from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator.js';
import { ZodBodyPipe } from '../../common/zod-body.pipe.js';
import { ProfileService } from './profile.service.js';

@ApiTags('profile')
@ApiBearerAuth()
@Controller('profile')
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

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
          maxItems: 6,
          uniqueItems: true,
          items: { type: 'string', minLength: 1, maxLength: 60 },
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
}
