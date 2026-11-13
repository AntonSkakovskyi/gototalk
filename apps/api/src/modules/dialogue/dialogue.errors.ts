import { NotFoundException } from '@nestjs/common';
import { ERROR_CODES, UtteranceSchema } from '@gototalk/shared';

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
