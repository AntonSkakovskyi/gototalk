import { Inject, Injectable, Logger } from '@nestjs/common';
import { TurnSchema } from '../../integrations/language-model/model-output.js';
import type { Turn } from '../../integrations/language-model/model-output.js';
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

  nextTurn(input: NextTurnInput): Promise<Turn> {
    return requestValidated(
      TurnSchema,
      () => this.languageModel.nextTurn(input),
      this.logger,
    );
  }
}
