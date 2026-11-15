import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HintRequestSchema, HintResultSchema } from '@gototalk/shared';
import type { HintRequest, HintResult } from '@gototalk/shared';
import {
  ApiZodBody,
  ApiZodResponse,
} from '../../common/swagger/api-zod.decorators.js';
import { ZodBodyPipe } from '../../common/pipes/zod-body.pipe.js';
import {
  CurrentUser,
  requireUserId,
} from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator.js';
import { RequiresConsent } from '../auth/decorators/requires-consent.decorator.js';
import { HintsService } from './hints.service.js';

@ApiTags('dialogue')
@ApiBearerAuth()
@Controller('sessions/:id/hints')
export class HintsController {
  constructor(private readonly hints: HintsService) {}

  @Post()
  @HttpCode(200)
  @RequiresConsent()
  @ApiOperation({
    summary: 'Get a hint for the current question',
    description:
      'phrase_start returns a sentence starter for the current question (the last assistant utterance). translation returns the English word for a Ukrainian word or null when it is unknown. A phrase and a translated word are stored with the hint, the word as a new vocabulary word (an existing word keeps its state); an unknown word stores nothing. Needs consent. 404 SESSION_NOT_FOUND for a foreign, unknown or malformed session id. 409 SESSION_FINISHED, or ANSWER_NOT_EXPECTED when the session has no question yet.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiZodBody(HintRequestSchema)
  @ApiZodResponse(HintResultSchema, {
    description:
      'HintResult: { kind: phrase_start, text } or { kind: translation, word } where word is null for an unknown word',
  })
  @ApiResponse({ status: 400, description: 'VALIDATION_ERROR' })
  @ApiResponse({ status: 401, description: 'UNAUTHORIZED' })
  @ApiResponse({ status: 403, description: 'CONSENT_REQUIRED' })
  @ApiResponse({ status: 404, description: 'SESSION_NOT_FOUND' })
  @ApiResponse({
    status: 409,
    description: 'SESSION_FINISHED, or ANSWER_NOT_EXPECTED',
  })
  @ApiResponse({
    status: 502,
    description: 'LANGUAGE_MODEL_INVALID_RESPONSE (nothing is stored)',
  })
  @ApiResponse({
    status: 503,
    description: 'LANGUAGE_MODEL_UNAVAILABLE (nothing is stored)',
  })
  hint(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id') id: string,
    @Body(new ZodBodyPipe(HintRequestSchema)) body: HintRequest,
  ): Promise<HintResult> {
    return this.hints.hint(requireUserId(user), id, body);
  }
}
