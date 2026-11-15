import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  PageQuerySchema,
  RECENT_SESSIONS_LIMIT,
  PlanSessionRequestSchema,
  StartSessionRequestSchema,
} from '@gototalk/shared';
import type {
  PageQuery,
  PlanSessionRequest,
  Session,
  SessionDetails,
  SessionPage,
  SessionPlan,
  StartSessionRequest,
} from '@gototalk/shared';
import {
  CurrentUser,
  requireUserId,
} from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator.js';
import { RequiresConsent } from '../auth/decorators/requires-consent.decorator.js';
import {
  ApiZodBody,
  ApiZodQuery,
} from '../../common/swagger/api-zod.decorators.js';
import { ZodBodyPipe } from '../../common/pipes/zod-body.pipe.js';
import { ZodQueryPipe } from '../../common/pipes/zod-query.pipe.js';
import { SessionPlannerService } from './session-planner.service.js';
import { SessionsService } from './sessions.service.js';

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
  @ApiZodBody(PlanSessionRequestSchema)
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
  @ApiZodBody(StartSessionRequestSchema)
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

  @Get('history')
  @ApiOperation({
    summary: 'Page through all sessions of the user',
    description:
      'Newest first (started_at, id) with keyset pagination: pass the returned nextCursor as cursor to get the next page. The cursor is opaque. nextCursor is null on the last page. Active and finished sessions are included. Needs no consent: nothing is sent to providers.',
  })
  @ApiZodQuery(PageQuerySchema)
  @ApiResponse({
    status: 200,
    description: 'SessionPage { items: Session[], nextCursor: string | null }',
  })
  @ApiResponse({ status: 400, description: 'VALIDATION_ERROR' })
  @ApiResponse({ status: 401, description: 'UNAUTHORIZED' })
  history(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query(new ZodQueryPipe(PageQuerySchema)) query: PageQuery,
  ): Promise<SessionPage> {
    return this.sessions.history(requireUserId(user), query);
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
