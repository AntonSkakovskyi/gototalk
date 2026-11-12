import { Inject, Injectable, NotImplementedException } from '@nestjs/common';
import type { Turn } from '@gototalk/shared';
import { LANGUAGE_MODEL_PORT } from '../ports/language-model.port.js';
import type {
  LanguageModelPort,
  NextTurnInput,
} from '../ports/language-model.port.js';

/** Ведення діалогу. Скелет: реалізація в spec 04. */
@Injectable()
export class DialogueService {
  constructor(
    @Inject(LANGUAGE_MODEL_PORT)
    protected readonly languageModel: LanguageModelPort,
  ) {}

  /** Наступне питання: з плану або уточнення до сказаного (`nextQuestion` з лабораторної 7). */
  async nextTurn(input: NextTurnInput): Promise<Turn> {
    void input;
    throw new NotImplementedException(
      'DialogueService.nextTurn: реалізація в spec 04 (docs/specs/04-dialog.md)',
    );
  }
}
