import { Inject, Injectable, Logger } from '@nestjs/common';
import { HintSchema } from '@gototalk/shared';
import type { Hint, HintRequest, HintResult } from '@gototalk/shared';
import { toLanguageModelHttpError } from '../../common/language-model-http-errors.js';
import { LANGUAGE_MODEL_PORT } from '../../integrations/language-model/language-model.port.js';
import type {
  HintInput,
  LanguageModelPort,
} from '../../integrations/language-model/language-model.port.js';
import { requestValidated } from '../../integrations/language-model/validated-call.js';
import { isSessionId, sessionNotFound } from '../session/session.errors.js';
import { toDialogueHttpError } from './dialogue.errors.js';
import { HintsRepository } from './persistence/hints.repository.js';
import type {
  CurrentQuestion,
  HintRecord,
} from './persistence/hints.repository.js';

function inputOf(request: HintRequest, question: CurrentQuestion): HintInput {
  if (request.kind === 'translation') return request;
  return {
    kind: 'phrase_start',
    question: question.text,
    questionNumber: question.number,
  };
}

function isUsable(hint: Hint, kind: HintRequest['kind']): boolean {
  return hint.kind === kind;
}

function resultOf(hint: Hint): HintResult {
  if (hint.kind === 'phrase_start') {
    return { kind: 'phrase_start', text: hint.text.trim() };
  }
  return { kind: 'translation', word: hint.word?.trim() ?? null };
}

function recordOf(request: HintRequest, result: HintResult): HintRecord | null {
  if (result.kind === 'phrase_start') return result;
  if (request.kind !== 'translation' || result.word === null) return null;
  return {
    kind: 'translation',
    lemma: result.word,
    translationUk: request.word,
  };
}

@Injectable()
export class HintsService {
  private readonly logger = new Logger(HintsService.name);

  constructor(
    private readonly hints: HintsRepository,
    @Inject(LANGUAGE_MODEL_PORT)
    private readonly languageModel: LanguageModelPort,
  ) {}

  /** The model runs outside any transaction; the hint is stored under the session lock afterwards. */
  async hint(
    userId: string,
    sessionId: string,
    request: HintRequest,
  ): Promise<HintResult> {
    if (!isSessionId(sessionId)) throw sessionNotFound();
    try {
      const question = await this.hints.currentQuestion(userId, sessionId);
      const hint = await requestValidated(
        HintSchema.refine((value) => isUsable(value, request.kind)),
        () => this.languageModel.hint(inputOf(request, question)),
        this.logger,
      );
      const result = resultOf(hint);
      const record = recordOf(request, result);
      if (record)
        await this.hints.save({ userId, sessionId, question, record });
      return result;
    } catch (error) {
      throw toLanguageModelHttpError(toDialogueHttpError(error));
    }
  }
}
