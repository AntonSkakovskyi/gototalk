import { ConflictException, NotFoundException } from '@nestjs/common';
import { ERROR_CODES, UtteranceSchema } from '@gototalk/shared';
import { toSessionHttpError } from '../session/session.errors.js';

export class AnswerNotExpectedError extends Error {
  constructor() {
    super('The last utterance is not an assistant question');
    this.name = 'AnswerNotExpectedError';
  }
}

export class UtteranceNotFoundError extends Error {
  constructor() {
    super('The utterance was not found');
    this.name = 'UtteranceNotFoundError';
  }
}

export function utteranceNotFound(): NotFoundException {
  return new NotFoundException({
    code: ERROR_CODES.UTTERANCE_NOT_FOUND,
    message: 'The utterance was not found',
  });
}

export function isUtteranceId(id: string): boolean {
  return UtteranceSchema.shape.id.safeParse(id).success;
}

/** Maps the domain errors of a session-bound dialogue request to HTTP exceptions; other errors pass through. */
export function toDialogueHttpError(error: unknown): unknown {
  if (error instanceof AnswerNotExpectedError) {
    return new ConflictException({
      code: ERROR_CODES.ANSWER_NOT_EXPECTED,
      message: 'There is no open question to answer',
    });
  }
  return toSessionHttpError(error);
}
