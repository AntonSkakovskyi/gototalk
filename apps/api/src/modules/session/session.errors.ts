import { NotFoundException } from '@nestjs/common';
import { ERROR_CODES, SessionSchema } from '@gototalk/shared';

export class SessionOwnerMissingError extends Error {
  constructor() {
    super('The session owner does not exist');
    this.name = 'SessionOwnerMissingError';
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
