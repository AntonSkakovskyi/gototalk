import { Body, Controller, HttpCode, Param, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MarkMistakeRequestSchema } from '@gototalk/shared';
import type { MarkMistakeRequest, MistakeView } from '@gototalk/shared';
import { ZodBodyPipe } from '../../common/zod-body.pipe.js';
import {
  CurrentUser,
  requireUserId,
} from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator.js';
import { MistakesService } from './mistakes.service.js';

@ApiTags('analysis')
@ApiBearerAuth()
@Controller('sessions/:id/mistakes')
export class MistakesController {
  constructor(private readonly mistakes: MistakesService) {}

  @Patch(':mistakeId')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Mark a mistake as "not a mistake"',
    description:
      'Sets is_false and lowers the frequency of the mistake category pattern by one, never below 0. Idempotent: repeating the call returns the same mistake and lowers nothing. Works on finished sessions and needs no consent. Foreign, unknown and malformed session ids give one 404; foreign, other-session, unknown and malformed mistake ids give another.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'mistakeId', format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['isFalse'],
      properties: { isFalse: { type: 'boolean', enum: [true] } },
    },
  })
  @ApiOkResponse({ description: 'MistakeView with isFalse: true' })
  @ApiResponse({ status: 400, description: 'VALIDATION_ERROR' })
  @ApiResponse({ status: 401, description: 'UNAUTHORIZED' })
  @ApiResponse({
    status: 404,
    description: 'SESSION_NOT_FOUND or MISTAKE_NOT_FOUND',
  })
  markFalse(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id') id: string,
    @Param('mistakeId') mistakeId: string,
    @Body(new ZodBodyPipe(MarkMistakeRequestSchema)) body: MarkMistakeRequest,
  ): Promise<MistakeView> {
    // The pipe is the whole use of the body: the only valid value is { isFalse: true }
    void body;
    return this.mistakes.markFalse(requireUserId(user), id, mistakeId);
  }
}
