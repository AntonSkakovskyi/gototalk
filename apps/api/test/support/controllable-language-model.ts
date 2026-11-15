import { FakeLanguageModel } from '../../src/integrations/language-model/fake/fake-language-model.js';
import { LanguageModelUnavailableError } from '../../src/integrations/language-model/language-model.errors.js';
import type {
  AnalyzeUtteranceInput,
  AnalyzeUtteranceResponse,
  HintInput,
  LanguageModelPort,
  NextTurnInput,
  PlanSessionInput,
  SummarizeSessionInput,
  SummarizeSessionResponse,
} from '../../src/integrations/language-model/language-model.port.js';

interface HintHold {
  started: () => void;
  released: Promise<void>;
}

/** Fake model whose calls are counted and whose failures can be switched on and off. */
export class ControllableLanguageModel implements LanguageModelPort {
  readonly calls = { analyze: 0, nextTurn: 0, hint: 0, summarize: 0 };
  analysisUnavailable = false;
  nextTurnUnavailable = false;
  nextTurnInvalid = false;
  summaryUnavailable = false;
  /** When set, summarizeSession() returns it as the output instead of the Fake's summary. */
  summaryOutput: unknown = undefined;
  /** When set, hint() returns it instead of the Fake's answer. */
  hintOutput: unknown = undefined;
  private hintHold: HintHold | null = null;
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
    this.summaryUnavailable = false;
    this.summaryOutput = undefined;
    this.hintOutput = undefined;
    this.hintHold = null;
  }

  reset(): void {
    this.recover();
    this.calls.analyze = 0;
    this.calls.nextTurn = 0;
    this.calls.hint = 0;
    this.calls.summarize = 0;
  }

  /** Makes the next hint() calls wait until release() is called; `started` resolves once a call is in flight. */
  holdHint(): { started: Promise<void>; release: () => void } {
    let release = (): void => undefined;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      this.hintHold = { started: resolve, released };
    });
    return { started, release };
  }

  planSession(input: PlanSessionInput): Promise<unknown> {
    return this.inner.planSession(input);
  }

  async hint(input: HintInput): Promise<unknown> {
    this.calls.hint += 1;
    if (this.hintHold) {
      this.hintHold.started();
      await this.hintHold.released;
    }
    if (this.hintOutput !== undefined) return this.hintOutput;
    return this.inner.hint(input);
  }

  async summarizeSession(
    input: SummarizeSessionInput,
  ): Promise<SummarizeSessionResponse> {
    this.calls.summarize += 1;
    if (this.summaryUnavailable) throw new LanguageModelUnavailableError();
    const response = await this.inner.summarizeSession(input);
    if (this.summaryOutput === undefined) return response;
    return { ...response, output: this.summaryOutput };
  }
}
