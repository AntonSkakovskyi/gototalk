import { ConflictException, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '@gototalk/shared';
import type { Utterance } from '@gototalk/shared';
import { isSessionId, sessionNotFound } from '../session/session.errors.js';
import {
  AnswerNotExpectedError,
  SessionFinishedError,
  SessionNotFoundError,
} from './dialogue.errors.js';
import { DialogueRepository } from './persistence/dialogue.repository.js';
import type { AnswerTexts } from './persistence/dialogue.repository.js';

function toHttpError(error: unknown): unknown {
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

@Injectable()
export class AnswersService {
  constructor(private readonly dialogue: DialogueRepository) {}

  async submit(
    userId: string,
    sessionId: string,
    answer: AnswerTexts,
  ): Promise<Utterance> {
    if (!isSessionId(sessionId)) throw sessionNotFound();
    try {
      return await this.dialogue.submitAnswer(userId, sessionId, answer);
    } catch (error) {
      throw toHttpError(error);
    }
  }
}
