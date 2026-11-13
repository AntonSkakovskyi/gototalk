import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  MAX_TOPIC_REROLLS,
  PlanSessionRequestSchema,
  TOPIC_MAX,
} from '@gototalk/shared';
import type { PlanSessionRequest, SessionPlan } from '@gototalk/shared';
import {
  CurrentUser,
  requireUserId,
} from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator.js';
import { RequiresConsent } from '../auth/decorators/requires-consent.decorator.js';
import { ZodBodyPipe } from '../../common/zod-body.pipe.js';
import { SessionPlannerService } from './session-planner.service.js';

const TOPIC_SCHEMA = {
  type: 'string',
  minLength: 1,
  maxLength: TOPIC_MAX,
} as const;

@ApiTags('sessions')
@ApiBearerAuth()
@Controller('sessions')
export class SessionsController {
  constructor(private readonly planner: SessionPlannerService) {}

  @Post('plan')
  @HttpCode(HttpStatus.OK)
  @RequiresConsent()
  @ApiOperation({
    summary: 'Propose a topic and questions for a new session',
    description:
      'Nothing is stored. Level, scenes, active goals and the custom topic are sent to the language model, so consent is required. previousTopics are the topics already shown; the server returns a different one. customTopic wins over previousTopics.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        previousTopics: {
          type: 'array',
          maxItems: MAX_TOPIC_REROLLS,
          items: TOPIC_SCHEMA,
        },
        customTopic: TOPIC_SCHEMA,
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'SessionPlan { topic, topicSource, questions }',
  })
  @ApiResponse({ status: 400, description: 'VALIDATION_ERROR' })
  @ApiResponse({ status: 401, description: 'UNAUTHORIZED' })
  @ApiResponse({ status: 403, description: 'CONSENT_REQUIRED' })
  @ApiResponse({ status: 404, description: 'PROFILE_NOT_FOUND' })
  @ApiResponse({
    status: 502,
    description: 'LANGUAGE_MODEL_INVALID_RESPONSE',
  })
  plan(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body(new ZodBodyPipe(PlanSessionRequestSchema)) body: PlanSessionRequest,
  ): Promise<SessionPlan> {
    return this.planner.plan(requireUserId(user), body);
  }
}
