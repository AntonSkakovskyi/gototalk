import { Inject, Injectable, Logger } from '@nestjs/common';
import type { TurnResult } from '@gototalk/shared';
import { toLanguageModelHttpError } from '../../common/language-model-http-errors.js';
import {
  LanguageModelInvalidResponseError,
  LanguageModelUnavailableError,
} from '../../integrations/language-model/language-model.errors.js';
import { MistakeAnalyzerService } from '../analysis/mistake-analyzer.service.js';
import { isSessionId, sessionNotFound } from '../session/session.errors.js';
import { SessionsRepository } from '../session/sessions.repository.js';
import {
  SessionNotFoundError,
  UtteranceNotFoundError,
  isUtteranceId,
  utteranceNotFound,
} from './dialogue.errors.js';
import { toTurnResult } from './lib/turn-result.js';
import { nextTurnInputOf, turnNeeds } from './lib/turn-state.js';
import type { TurnState } from './lib/turn-state.js';
import { NextTurnService } from './next-turn.service.js';
import { TurnRepository } from './persistence/turn.repository.js';
import type { TurnWrites } from './persistence/turn.repository.js';

function toHttpError(error: unknown): unknown {
  if (error instanceof SessionNotFoundError) return sessionNotFound();
  if (error instanceof UtteranceNotFoundError) return utteranceNotFound();
  return error;
}

function valueOf<T>(settled: PromiseSettledResult<T | null>): T | null {
  return settled.status === 'fulfilled' ? settled.value : null;
}

function reasonsOf(settled: PromiseSettledResult<unknown>[]): unknown[] {
  return settled.flatMap((result) =>
    result.status === 'rejected' ? [result.reason] : [],
  );
}

@Injectable()
export class TurnService {
  private readonly logger = new Logger(TurnService.name);

  constructor(
    @Inject(TurnRepository)
    private readonly turns: Pick<TurnRepository, 'loadState' | 'persist'>,
    @Inject(SessionsRepository)
    private readonly sessions: Pick<SessionsRepository, 'findDetails'>,
    @Inject(MistakeAnalyzerService)
    private readonly analyzer: Pick<MistakeAnalyzerService, 'analyze'>,
    @Inject(NextTurnService)
    private readonly nextTurn: Pick<NextTurnService, 'nextTurn'>,
  ) {}

  async run(
    userId: string,
    sessionId: string,
    utteranceId: string,
  ): Promise<TurnResult> {
    if (!isSessionId(sessionId)) throw sessionNotFound();
    if (!isUtteranceId(utteranceId)) throw utteranceNotFound();
    try {
      const state = await this.turns.loadState(userId, sessionId, utteranceId);
      const reasons = await this.callModelsAndStore(userId, sessionId, state);
      if (reasons.length > 0) throw this.pickFailure(reasons);
      return await this.storedResult(userId, sessionId, utteranceId);
    } catch (error) {
      throw toHttpError(error);
    }
  }

  // Models run outside any transaction; whatever succeeded is stored before a failure is raised
  private async callModelsAndStore(
    userId: string,
    sessionId: string,
    state: TurnState,
  ): Promise<unknown[]> {
    const needs = turnNeeds(state);
    const [analysis, turn] = await Promise.allSettled([
      needs.analysis
        ? this.analyzer.analyze(state.target.textVerbatim)
        : Promise.resolve(null),
      needs.reply
        ? this.nextTurn.nextTurn(nextTurnInputOf(state))
        : Promise.resolve(null),
    ]);
    const writes: TurnWrites = {
      analysis: valueOf(analysis),
      reply: valueOf(turn)?.question ?? null,
    };
    if (writes.analysis || writes.reply !== null) {
      await this.turns.persist(userId, sessionId, state.target, writes);
    }
    return reasonsOf([analysis, turn]);
  }

  private pickFailure(reasons: unknown[]): unknown {
    const unavailable = reasons.find(
      (reason) => reason instanceof LanguageModelUnavailableError,
    );
    if (unavailable) {
      this.logger.warn('Language model unavailable');
      return toLanguageModelHttpError(unavailable);
    }
    const invalid = reasons.find(
      (reason) => reason instanceof LanguageModelInvalidResponseError,
    );
    return toLanguageModelHttpError(invalid ?? reasons[0]);
  }

  private async storedResult(
    userId: string,
    sessionId: string,
    utteranceId: string,
  ): Promise<TurnResult> {
    const details = await this.sessions.findDetails(userId, sessionId);
    if (!details) throw new SessionNotFoundError();
    const result = toTurnResult(details, utteranceId);
    if (!result) throw new UtteranceNotFoundError();
    return result;
  }
}
