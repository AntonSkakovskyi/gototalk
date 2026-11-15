import { ConflictException, NotFoundException } from '@nestjs/common';
import { ERROR_CODES, SessionSchema } from '@gototalk/shared';

export class AnswerNotExpectedError extends Error {
  constructor() {
    super('The last utterance is not an assistant question');
    this.name = 'AnswerNotExpectedError';
  }
}

export class SessionOwnerMissingError extends Error {
  constructor() {
    super('The session owner does not exist');
    this.name = 'SessionOwnerMissingError';
  }
}

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

export function sessionNotFound(): NotFoundException {
  return new NotFoundException({
    code: ERROR_CODES.SESSION_NOT_FOUND,
    message: 'The session was not found',
  });
}

export function isSessionId(id: string): boolean {
  return SessionSchema.shape.id.safeParse(id).success;
}

/** Maps the session domain errors to HTTP exceptions; other errors pass through. */
export function toSessionHttpError(error: unknown): unknown {
  if (error instanceof AnswerNotExpectedError) {
    return new ConflictException({
      code: ERROR_CODES.ANSWER_NOT_EXPECTED,
      message: 'There is no open question to answer',
    });
  }
  if (error instanceof SessionNotFoundError) return sessionNotFound();
  if (error instanceof SessionFinishedError) {
    return new ConflictException({
      code: ERROR_CODES.SESSION_FINISHED,
      message: 'The session is already finished',
    });
  }
  return error;
}
