import { Inject, Injectable, Logger } from '@nestjs/common';
import { BetterPhrasingSchema } from '@gototalk/shared';
import {
  AnalysisEnvelopeSchema,
  MistakeSchema,
} from '../../integrations/language-model/model-output.js';
import type { AnalysisEnvelope } from '../../integrations/language-model/model-output.js';
import type { z } from 'zod';
import { LANGUAGE_MODEL_PORT } from '../../integrations/language-model/language-model.port.js';
import type { LanguageModelPort } from '../../integrations/language-model/language-model.port.js';
import { LanguageModelInvalidResponseError } from '../../integrations/language-model/language-model.errors.js';
import { requestValidated } from '../../integrations/language-model/validated-call.js';
import { alignMistakes } from './lib/align-mistakes.js';
import type { AnalysisOutcome } from './mistake-analyzer.types.js';

const BETTER_SAVED_MAX = 2;

@Injectable()
export class MistakeAnalyzerService {
  private readonly logger = new Logger(MistakeAnalyzerService.name);

  constructor(
    @Inject(LANGUAGE_MODEL_PORT)
    private readonly languageModel: LanguageModelPort,
  ) {}

  /** `text` is text_verbatim: mistake positions are offsets in it. */
  async analyze(text: string): Promise<AnalysisOutcome> {
    let promptVersion = '';
    let model = '';
    const call = async (): Promise<unknown> => {
      const response = await this.languageModel.analyzeUtterance({ text });
      promptVersion = response.promptVersion;
      model = response.model;
      return response.output;
    };

    let envelope: AnalysisEnvelope;
    try {
      envelope = await requestValidated(
        AnalysisEnvelopeSchema,
        call,
        this.logger,
      );
    } catch (error) {
      if (error instanceof LanguageModelInvalidResponseError) {
        return { status: 'failed', promptVersion, model };
      }
      throw error;
    }

    const parsedMistakes = parseItems(MistakeSchema, envelope.mistakes);
    const parsedBetter = parseItems(BetterPhrasingSchema, envelope.better);
    const { mistakes, dropped } = alignMistakes(text, parsedMistakes.items);
    const invalid = parsedMistakes.invalid + parsedBetter.invalid;
    if (invalid > 0 || dropped > 0) {
      this.logger.warn({ invalid, dropped }, 'Analysis items dropped');
    }
    return {
      status: 'done',
      mistakes,
      better: parsedBetter.items.slice(0, BETTER_SAVED_MAX),
      promptVersion,
      model,
    };
  }
}

function parseItems<T>(
  schema: z.ZodType<T>,
  items: unknown[],
): { items: T[]; invalid: number } {
  const valid: T[] = [];
  for (const item of items) {
    const parsed = schema.safeParse(item);
    if (parsed.success) valid.push(parsed.data);
  }
  return { items: valid, invalid: items.length - valid.length };
}
