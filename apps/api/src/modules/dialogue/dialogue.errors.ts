import { ConflictException, NotFoundException } from '@nestjs/common';
import { ERROR_CODES, UtteranceSchema } from '@gototalk/shared';
import { sessionNotFound } from '../session/session.errors.js';

export class SessionNotFoundError extends Error {
  constructor() {
    super('The session was not found');
    this.name = 'SessionNotFoundError';
  }
}

export class SessionFinishedError extends Error {
  constructor() {
    super('The session is already finished');
    this.name = 'SessionFinishedError';
  }
}

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
  if (error instanceof SessionNotFoundError) return sessionNotFound();
  if (error instanceof SessionFinishedError) {
    return new ConflictException({
      code: ERROR_CODES.SESSION_FINISHED,
      message: 'The session is already finished',
    });
  }
  if (error instanceof AnswerNotExpectedError) {
    return new ConflictException({
      code: ERROR_CODES.ANSWER_NOT_EXPECTED,
      message: 'There is no open question to answer',
    });
  }
  return error;
}
