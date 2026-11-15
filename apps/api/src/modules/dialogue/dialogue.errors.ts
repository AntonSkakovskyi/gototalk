import { NotFoundException } from '@nestjs/common';
import { ERROR_CODES, UtteranceSchema } from '@gototalk/shared';

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
