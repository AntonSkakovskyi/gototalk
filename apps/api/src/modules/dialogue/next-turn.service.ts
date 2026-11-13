import { Inject, Injectable, Logger } from '@nestjs/common';
import { TurnSchema } from '@gototalk/shared';
import type { Turn } from '@gototalk/shared';
import { toLanguageModelHttpError } from '../../common/language-model-http-errors.js';
import { LanguageModelUnavailableError } from '../../integrations/language-model/language-model.errors.js';
import { LANGUAGE_MODEL_PORT } from '../../integrations/language-model/language-model.port.js';
import type {
  LanguageModelPort,
  NextTurnInput,
} from '../../integrations/language-model/language-model.port.js';
import { requestValidated } from '../../integrations/language-model/validated-call.js';

@Injectable()
export class NextTurnService {
  private readonly logger = new Logger(NextTurnService.name);

  constructor(
    @Inject(LANGUAGE_MODEL_PORT)
    private readonly languageModel: LanguageModelPort,
  ) {}

  async nextTurn(input: NextTurnInput): Promise<Turn> {
    try {
      return await requestValidated(
        TurnSchema,
        () => this.languageModel.nextTurn(input),
        this.logger,
      );
    } catch (error) {
      if (error instanceof LanguageModelUnavailableError) {
        this.logger.warn('Language model unavailable');
      }
      throw toLanguageModelHttpError(error);
    }
  }
}
