import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ANSWER_TEXT_MAX, AnswerTextRequestSchema } from '@gototalk/shared';
import type {
  AnswerTextRequest,
  TurnResult,
  Utterance,
} from '@gototalk/shared';
import { ZodBodyPipe } from '../../common/zod-body.pipe.js';
import {
  CurrentUser,
  requireUserId,
} from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator.js';
import { RequiresConsent } from '../auth/decorators/requires-consent.decorator.js';
import { AnswersService } from './answers.service.js';
import { TurnService } from './turn.service.js';

@ApiTags('dialogue')
@ApiBearerAuth()
@Controller('sessions/:id/utterances')
export class DialogueController {
  constructor(
    private readonly answers: AnswersService,
    private readonly turns: TurnService,
  ) {}

  @Post()
  @RequiresConsent()
  @ApiOperation({
    summary: 'Submit a text answer to the current question (step 1)',
    description:
      'Stores the answer as a pending user utterance (text_verbatim = text_clean = text) and marks the vocabulary words it uses. No language model or speech call is made; analysis is a separate step. A foreign, unknown or malformed session id gives the same 404.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['text'],
      properties: {
        text: { type: 'string', minLength: 1, maxLength: ANSWER_TEXT_MAX },
      },
    },
  })
  @ApiCreatedResponse({
    description:
      'Utterance { id, seq, role: user, text, analysisStatus: pending, mistakes: [], better: [] }',
  })
  @ApiResponse({ status: 400, description: 'VALIDATION_ERROR' })
  @ApiResponse({ status: 401, description: 'UNAUTHORIZED' })
  @ApiResponse({ status: 403, description: 'CONSENT_REQUIRED' })
  @ApiResponse({ status: 404, description: 'SESSION_NOT_FOUND' })
  @ApiResponse({
    status: 409,
    description:
      'SESSION_FINISHED, or ANSWER_NOT_EXPECTED when the last utterance is not an assistant question',
  })
  answer(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id') id: string,
    @Body(new ZodBodyPipe(AnswerTextRequestSchema)) body: AnswerTextRequest,
  ): Promise<Utterance> {
    return this.answers.submit(requireUserId(user), id, {
      verbatim: body.text,
      clean: body.text,
    });
  }

  @Post(':utteranceId/analysis')
  @HttpCode(200)
  @RequiresConsent()
  @ApiOperation({
    summary: 'Analyse an answer and get the next question (step 2)',
    description:
      'Idempotent: runs the mistake analysis if the utterance is still pending and asks the language model for the next question if there is none yet, then stores the missing parts. Already stored parts are returned without a model call. A failed analysis (invalid model response twice) is stored as failed, not as an error. If a model call is unavailable or invalid, the successful part is stored first and the error is returned; a repeat call completes the rest. A finished session is analysed but gets no reply. Foreign, unknown and malformed session or utterance ids give the same 404.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'utteranceId', format: 'uuid' })
  @ApiOkResponse({
    description:
      'TurnResult { utterance (analysisStatus done or failed, with mistakes and better), reply (the next assistant utterance or null), planRemaining }',
  })
  @ApiResponse({ status: 401, description: 'UNAUTHORIZED' })
  @ApiResponse({ status: 403, description: 'CONSENT_REQUIRED' })
  @ApiResponse({
    status: 404,
    description:
      'SESSION_NOT_FOUND, or UTTERANCE_NOT_FOUND for an unknown, assistant or foreign-session utterance',
  })
  @ApiResponse({
    status: 502,
    description: 'LANGUAGE_MODEL_INVALID_RESPONSE (next question)',
  })
  @ApiResponse({ status: 503, description: 'LANGUAGE_MODEL_UNAVAILABLE' })
  analyse(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id') id: string,
    @Param('utteranceId') utteranceId: string,
  ): Promise<TurnResult> {
    return this.turns.run(requireUserId(user), id, utteranceId);
  }
}
