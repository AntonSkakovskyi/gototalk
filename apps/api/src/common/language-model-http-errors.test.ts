import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ERROR_CODES } from '@gototalk/shared';
import { describe, expect, it } from 'vitest';
import { LanguageModelUnavailableError } from '../integrations/language-model/language-model.errors.js';
import { LanguageModelInvalidResponseError } from '../integrations/language-model/validated-call.js';
import { toLanguageModelHttpError } from './language-model-http-errors.js';

describe('toLanguageModelHttpError', () => {
  it('[TC-04-08] maps an invalid response to 502 LANGUAGE_MODEL_INVALID_RESPONSE', () => {
    const error = toLanguageModelHttpError(
      new LanguageModelInvalidResponseError(),
    );

    expect(error).toBeInstanceOf(BadGatewayException);
    if (!(error instanceof BadGatewayException)) return;
    expect(error.getResponse()).toEqual({
      code: ERROR_CODES.LANGUAGE_MODEL_INVALID_RESPONSE,
      message: 'The language model returned an invalid response',
    });
  });

  it('[TC-04-08] maps an unavailable model to 503 LANGUAGE_MODEL_UNAVAILABLE', () => {
    const error = toLanguageModelHttpError(new LanguageModelUnavailableError());

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    if (!(error instanceof ServiceUnavailableException)) return;
    expect(error.getResponse()).toEqual({
      code: ERROR_CODES.LANGUAGE_MODEL_UNAVAILABLE,
      message: 'The language model is unavailable',
    });
  });

  it('[TC-04-08] returns any other error unchanged', () => {
    const other = new Error('provider is down');

    expect(toLanguageModelHttpError(other)).toBe(other);
  });
});
