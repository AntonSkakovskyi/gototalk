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
import { MarkWordRequestSchema, MARKABLE_WORD_STATES } from '@gototalk/shared';
import type { MarkWordRequest, Word } from '@gototalk/shared';
import { ZodBodyPipe } from '../../common/zod-body.pipe.js';
import {
  CurrentUser,
  requireUserId,
} from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator.js';
import { WordsService } from './words.service.js';

@ApiTags('vocabulary')
@ApiBearerAuth()
@Controller('words')
export class WordsController {
  constructor(private readonly words: WordsService) {}

  @Patch(':id')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Set the learning state of a word by hand',
    description:
      'Moves a word between new, partial and passive. Setting the current state again is a no-op. Active is earned through use and cannot be set or changed by hand. Needs no consent. 404 WORD_NOT_FOUND for a foreign, unknown or malformed id.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['state'],
      properties: {
        state: { type: 'string', enum: [...MARKABLE_WORD_STATES] },
      },
    },
  })
  @ApiOkResponse({ description: 'The word with its new state' })
  @ApiResponse({ status: 400, description: 'VALIDATION_ERROR' })
  @ApiResponse({ status: 401, description: 'UNAUTHORIZED' })
  @ApiResponse({ status: 404, description: 'WORD_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'WORD_ALREADY_ACTIVE' })
  mark(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id') id: string,
    @Body(new ZodBodyPipe(MarkWordRequestSchema)) body: MarkWordRequest,
  ): Promise<Word> {
    return this.words.mark(requireUserId(user), id, body.state);
  }
}
