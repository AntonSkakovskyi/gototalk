import { NotFoundException } from '@nestjs/common';
import { ERROR_CODES, MistakeViewSchema } from '@gototalk/shared';

export class MistakeSessionNotFoundError extends Error {
  constructor() {
    super('The session was not found');
    this.name = 'MistakeSessionNotFoundError';
  }
}

export class MistakeNotFoundError extends Error {
  constructor() {
    super('The mistake was not found');
    this.name = 'MistakeNotFoundError';
  }
}

export function mistakeNotFound(): NotFoundException {
  return new NotFoundException({
    code: ERROR_CODES.MISTAKE_NOT_FOUND,
    message: 'The mistake was not found',
  });
}

export function isMistakeId(id: string): boolean {
  return MistakeViewSchema.shape.id.safeParse(id).success;
}
