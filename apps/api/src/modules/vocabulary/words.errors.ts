import { ConflictException, NotFoundException } from '@nestjs/common';
import { ERROR_CODES } from '@gototalk/shared';

export class WordNotFoundError extends NotFoundException {
  constructor() {
    super({
      code: ERROR_CODES.WORD_NOT_FOUND,
      message: 'The word was not found',
    });
  }
}

export class WordAlreadyActiveError extends ConflictException {
  constructor() {
    super({
      code: ERROR_CODES.WORD_ALREADY_ACTIVE,
      message: 'An active word cannot be changed by hand',
    });
  }
}
