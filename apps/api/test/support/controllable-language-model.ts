import { FakeLanguageModel } from '../../src/integrations/language-model/fake-language-model.js';
import { LanguageModelUnavailableError } from '../../src/integrations/language-model/language-model.errors.js';
import type {
  AnalyzeUtteranceInput,
  AnalyzeUtteranceResponse,
  HintRequest,
  LanguageModelPort,
  NextTurnInput,
  PlanSessionInput,
} from '../../src/integrations/language-model/language-model.port.js';

/** Fake model whose calls are counted and whose failures can be switched on and off. */
export class ControllableLanguageModel implements LanguageModelPort {
  readonly calls = { analyze: 0, nextTurn: 0 };
  analysisUnavailable = false;
  nextTurnUnavailable = false;
  nextTurnInvalid = false;
  private readonly inner = new FakeLanguageModel();

  analyzeUtterance(
    input: AnalyzeUtteranceInput,
  ): Promise<AnalyzeUtteranceResponse> {
    this.calls.analyze += 1;
    if (this.analysisUnavailable) {
      return Promise.reject(new LanguageModelUnavailableError());
    }
    return this.inner.analyzeUtterance(input);
  }

  nextTurn(input: NextTurnInput): Promise<unknown> {
    this.calls.nextTurn += 1;
    if (this.nextTurnUnavailable) {
      return Promise.reject(new LanguageModelUnavailableError());
    }
    if (this.nextTurnInvalid) return Promise.resolve({ question: '' });
    return this.inner.nextTurn(input);
  }

  recover(): void {
    this.analysisUnavailable = false;
    this.nextTurnUnavailable = false;
    this.nextTurnInvalid = false;
  }

  reset(): void {
    this.recover();
    this.calls.analyze = 0;
    this.calls.nextTurn = 0;
  }

  planSession(input: PlanSessionInput): Promise<unknown> {
    return this.inner.planSession(input);
  }

  hint(request: HintRequest): Promise<unknown> {
    return this.inner.hint(request);
  }

  summarizeSession(): Promise<unknown> {
    return this.inner.summarizeSession();
  }
}
