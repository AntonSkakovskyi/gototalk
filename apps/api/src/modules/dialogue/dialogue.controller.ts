import { Body, Controller, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ANSWER_TEXT_MAX, AnswerTextRequestSchema } from '@gototalk/shared';
import type { AnswerTextRequest, Utterance } from '@gototalk/shared';
import { ZodBodyPipe } from '../../common/zod-body.pipe.js';
import {
  CurrentUser,
  requireUserId,
} from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator.js';
import { RequiresConsent } from '../auth/decorators/requires-consent.decorator.js';
import { AnswersService } from './answers.service.js';

@ApiTags('dialogue')
@ApiBearerAuth()
@Controller('sessions/:id/utterances')
export class DialogueController {
  constructor(private readonly answers: AnswersService) {}

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
}
