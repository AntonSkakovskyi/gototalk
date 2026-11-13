import { Inject, Injectable, NotImplementedException } from '@nestjs/common';
import type { Turn } from '@gototalk/shared';
import { LANGUAGE_MODEL_PORT } from '../../integrations/language-model/language-model.port.js';
import type {
  LanguageModelPort,
  NextTurnInput,
} from '../../integrations/language-model/language-model.port.js';

@Injectable()
export class DialogueService {
  constructor(
    @Inject(LANGUAGE_MODEL_PORT)
    protected readonly languageModel: LanguageModelPort,
  ) {}

  async nextTurn(input: NextTurnInput): Promise<Turn> {
    void input;
    throw new NotImplementedException(
      'Not implemented: DialogueService.nextTurn (see docs/specs/04-dialog.md)',
    );
  }
}
