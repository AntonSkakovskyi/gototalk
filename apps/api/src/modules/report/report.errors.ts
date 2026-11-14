import { ConflictException } from '@nestjs/common';
import { ERROR_CODES } from '@gototalk/shared';

export class SessionNotFinishedError extends ConflictException {
  constructor() {
    super({
      code: ERROR_CODES.SESSION_NOT_FINISHED,
      message: 'The report is available only for a finished session',
    });
  }
}
