import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  FEEDBACK_MODES,
  MAX_TOPIC_REROLLS,
  PLAN_QUESTIONS,
  RECENT_SESSIONS_LIMIT,
  PlanSessionRequestSchema,
  QUESTION_MAX,
  StartSessionRequestSchema,
  TOPIC_MAX,
  TOPIC_SOURCES,
} from '@gototalk/shared';
import type {
  PlanSessionRequest,
  Session,
  SessionDetails,
  SessionPlan,
  StartSessionRequest,
} from '@gototalk/shared';
import {
  CurrentUser,
  requireUserId,
} from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator.js';
import { RequiresConsent } from '../auth/decorators/requires-consent.decorator.js';
import { ZodBodyPipe } from '../../common/zod-body.pipe.js';
import { SessionPlannerService } from './session-planner.service.js';
import { SessionsService } from './sessions.service.js';

const TOPIC_SCHEMA = {
  type: 'string',
  minLength: 1,
  maxLength: TOPIC_MAX,
} as const;

@ApiTags('sessions')
@ApiBearerAuth()
@Controller('sessions')
export class SessionsController {
  constructor(
    private readonly planner: SessionPlannerService,
    private readonly sessions: SessionsService,
  ) {}

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

  @Post()
  @RequiresConsent()
  @ApiOperation({
    summary: 'Start a session from the plan the user was shown',
    description:
      'Finishes the active session of the user, if any, and stores the new one with all planned questions. The first question becomes the first assistant utterance. No language model call is made.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['topic', 'topicSource', 'questions'],
      properties: {
        topic: TOPIC_SCHEMA,
        topicSource: { type: 'string', enum: [...TOPIC_SOURCES] },
        questions: {
          type: 'array',
          minItems: PLAN_QUESTIONS,
          maxItems: PLAN_QUESTIONS,
          items: { type: 'string', minLength: 1, maxLength: QUESTION_MAX },
        },
        feedbackMode: {
          type: 'string',
          enum: [...FEEDBACK_MODES],
          default: 'immediate',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description:
      'SessionDetails { id, topic, topicSource, feedbackMode, status, startedAt, endedAt, utterances }',
  })
  @ApiResponse({ status: 400, description: 'VALIDATION_ERROR' })
  @ApiResponse({ status: 401, description: 'UNAUTHORIZED' })
  @ApiResponse({ status: 403, description: 'CONSENT_REQUIRED' })
  start(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body(new ZodBodyPipe(StartSessionRequestSchema)) body: StartSessionRequest,
  ): Promise<SessionDetails> {
    return this.sessions.start(requireUserId(user), body);
  }

  @Post(':id/finish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Finish the session',
    description:
      'Idempotent: finishing a finished session returns it unchanged and keeps its original endedAt. Needs no consent. 404 SESSION_NOT_FOUND for a foreign, unknown or malformed id.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description:
      'Session { id, topic, topicSource, feedbackMode, status, startedAt, endedAt }',
  })
  @ApiResponse({ status: 401, description: 'UNAUTHORIZED' })
  @ApiResponse({ status: 404, description: 'SESSION_NOT_FOUND' })
  finish(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id') id: string,
  ): Promise<Session> {
    return this.sessions.finish(requireUserId(user), id);
  }

  @Get()
  @ApiOperation({
    summary: 'List the most recent sessions of the user',
    description: `Newest first, at most ${RECENT_SESSIONS_LIMIT}. No pagination. Needs no consent: nothing is sent to providers.`,
  })
  @ApiResponse({
    status: 200,
    description:
      'Session[] { id, topic, topicSource, feedbackMode, status, startedAt, endedAt }',
  })
  @ApiResponse({ status: 401, description: 'UNAUTHORIZED' })
  list(@CurrentUser() user: AuthenticatedUser | undefined): Promise<Session[]> {
    return this.sessions.list(requireUserId(user));
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a session with its utterances',
    description:
      'Utterances are ordered by seq. The stored plan is never returned. A foreign, unknown or malformed id gives the same 404 (a malformed id is not a 400).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description:
      'SessionDetails { id, topic, topicSource, feedbackMode, status, startedAt, endedAt, utterances }',
  })
  @ApiResponse({ status: 401, description: 'UNAUTHORIZED' })
  @ApiResponse({ status: 404, description: 'SESSION_NOT_FOUND' })
  details(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id') id: string,
  ): Promise<SessionDetails> {
    return this.sessions.details(requireUserId(user), id);
  }
}
