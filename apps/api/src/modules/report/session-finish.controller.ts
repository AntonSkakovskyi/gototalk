import { Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SessionSchema } from '@gototalk/shared';
import type { Session } from '@gototalk/shared';
import { ApiZodResponse } from '../../common/swagger/api-zod.decorators.js';
import {
  CurrentUser,
  requireUserId,
} from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator.js';
import { RequiresConsent } from '../auth/decorators/requires-consent.decorator.js';
import { SessionFinishService } from './session-finish.service.js';

@ApiTags('sessions')
@ApiBearerAuth()
@Controller('sessions')
export class SessionFinishController {
  constructor(private readonly finishing: SessionFinishService) {}

  @Post(':id/finish')
  @HttpCode(HttpStatus.OK)
  @RequiresConsent()
  @ApiOperation({
    summary: 'Finish the session',
    description:
      'Idempotent: finishing a finished session returns it unchanged and keeps its original endedAt. Generates the session report best-effort (the summary goes to the language model, so consent is required); a model failure does not fail the call. 404 SESSION_NOT_FOUND for a foreign, unknown or malformed id.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiZodResponse(SessionSchema, {
    description:
      'Session { id, topic, topicSource, feedbackMode, status, startedAt, endedAt }',
  })
  @ApiResponse({ status: 401, description: 'UNAUTHORIZED' })
  @ApiResponse({ status: 403, description: 'CONSENT_REQUIRED' })
  @ApiResponse({ status: 404, description: 'SESSION_NOT_FOUND' })
  finish(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id') id: string,
  ): Promise<Session> {
    return this.finishing.finish(requireUserId(user), id);
  }
}
