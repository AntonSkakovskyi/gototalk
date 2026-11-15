import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreateGoalRequestSchema,
  GOAL_STATUSES,
  GOAL_TITLE_MAX,
  MAX_ACTIVE_GOALS,
  UpdateGoalRequestSchema,
} from '@gototalk/shared';
import type {
  CreateGoalRequest,
  Goal,
  UpdateGoalRequest,
} from '@gototalk/shared';
import {
  CurrentUser,
  requireUserId,
} from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator.js';
import { ZodBodyPipe } from '../../common/pipes/zod-body.pipe.js';
import { GoalsService } from './goals.service.js';

const TITLE_SCHEMA = {
  type: 'string',
  minLength: 1,
  maxLength: GOAL_TITLE_MAX,
} as const;
const ID_PARAM = { name: 'id', description: 'Goal id (uuid)' } as const;
const LIMIT_DESCRIPTION = `ACTIVE_GOALS_LIMIT: more than ${MAX_ACTIVE_GOALS} active goals`;

@ApiTags('goals')
@ApiBearerAuth()
@Controller('goals')
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}

  @Get()
  @ApiOperation({ summary: 'List the goals of the user, oldest first' })
  @ApiResponse({
    status: 200,
    description: 'Goal[] { id, title, status, createdAt }',
  })
  @ApiResponse({ status: 401, description: 'UNAUTHORIZED' })
  list(@CurrentUser() user: AuthenticatedUser | undefined): Promise<Goal[]> {
    return this.goals.list(requireUserId(user));
  }

  @Post()
  @ApiOperation({ summary: 'Create an active goal' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['title'],
      properties: { title: TITLE_SCHEMA },
    },
  })
  @ApiResponse({ status: 201, description: 'The created Goal' })
  @ApiResponse({ status: 400, description: 'VALIDATION_ERROR' })
  @ApiResponse({ status: 401, description: 'UNAUTHORIZED' })
  @ApiResponse({ status: 409, description: LIMIT_DESCRIPTION })
  create(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body(new ZodBodyPipe(CreateGoalRequestSchema)) body: CreateGoalRequest,
  ): Promise<Goal> {
    return this.goals.create(requireUserId(user), body);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Change the title or the status of a goal',
    description:
      'Moving a done goal back to active checks the active-goals limit.',
  })
  @ApiParam(ID_PARAM)
  @ApiBody({
    schema: {
      type: 'object',
      minProperties: 1,
      properties: {
        title: TITLE_SCHEMA,
        status: { type: 'string', enum: [...GOAL_STATUSES] },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'The updated Goal' })
  @ApiResponse({ status: 400, description: 'VALIDATION_ERROR' })
  @ApiResponse({ status: 401, description: 'UNAUTHORIZED' })
  @ApiResponse({ status: 404, description: 'GOAL_NOT_FOUND' })
  @ApiResponse({ status: 409, description: LIMIT_DESCRIPTION })
  update(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id') id: string,
    @Body(new ZodBodyPipe(UpdateGoalRequestSchema)) body: UpdateGoalRequest,
  ): Promise<Goal> {
    return this.goals.update(requireUserId(user), id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a goal' })
  @ApiParam(ID_PARAM)
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 401, description: 'UNAUTHORIZED' })
  @ApiResponse({ status: 404, description: 'GOAL_NOT_FOUND' })
  remove(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id') id: string,
  ): Promise<void> {
    return this.goals.remove(requireUserId(user), id);
  }
}
