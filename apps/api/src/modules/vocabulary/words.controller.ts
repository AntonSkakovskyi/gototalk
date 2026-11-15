import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  MarkWordRequestSchema,
  MARKABLE_WORD_STATES,
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
  PageQuerySchema,
} from '@gototalk/shared';
import type {
  MarkWordRequest,
  PageQuery,
  Word,
  WordPage,
} from '@gototalk/shared';
import { ZodBodyPipe } from '../../common/pipes/zod-body.pipe.js';
import { ZodQueryPipe } from '../../common/pipes/zod-query.pipe.js';
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

  @Get()
  @ApiOperation({
    summary: 'Page through all words of the user',
    description:
      'Newest first (created_at, id) with keyset pagination: pass the returned nextCursor as cursor to get the next page. The cursor is opaque. nextCursor is null on the last page. All states and sources are included. Needs no consent: nothing is sent to providers.',
  })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    minimum: 1,
    maximum: PAGE_SIZE_MAX,
    example: PAGE_SIZE_DEFAULT,
  })
  @ApiOkResponse({
    description:
      'WordPage { items: Word[], nextCursor: string | null }, Word { id, lemma, translationUk, state, source }',
  })
  @ApiResponse({ status: 400, description: 'VALIDATION_ERROR' })
  @ApiResponse({ status: 401, description: 'UNAUTHORIZED' })
  list(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query(new ZodQueryPipe(PageQuerySchema)) query: PageQuery,
  ): Promise<WordPage> {
    return this.words.list(requireUserId(user), query);
  }

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
  @ApiOkResponse({
    description:
      'Word { id, lemma, translationUk, state, source } with its new state',
  })
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
