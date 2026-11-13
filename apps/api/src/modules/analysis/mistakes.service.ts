import { Injectable } from '@nestjs/common';
import type { MistakeView } from '@gototalk/shared';
import { isSessionId, sessionNotFound } from '../session/session.errors.js';
import {
  MistakeNotFoundError,
  MistakeSessionNotFoundError,
  isMistakeId,
  mistakeNotFound,
} from './mistakes.errors.js';
import { MistakesRepository } from './persistence/mistakes.repository.js';

@Injectable()
export class MistakesService {
  constructor(private readonly mistakes: MistakesRepository) {}

  async markFalse(
    userId: string,
    sessionId: string,
    mistakeId: string,
  ): Promise<MistakeView> {
    if (!isSessionId(sessionId)) throw sessionNotFound();
    if (!isMistakeId(mistakeId)) throw mistakeNotFound();
    try {
      return await this.mistakes.markFalse(userId, sessionId, mistakeId);
    } catch (error) {
      if (error instanceof MistakeSessionNotFoundError) throw sessionNotFound();
      if (error instanceof MistakeNotFoundError) throw mistakeNotFound();
      throw error;
    }
  }
}
