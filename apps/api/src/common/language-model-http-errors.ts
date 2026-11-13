import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ERROR_CODES } from '@gototalk/shared';
import { LanguageModelUnavailableError } from '../integrations/language-model/language-model.errors.js';
import { LanguageModelInvalidResponseError } from '../integrations/language-model/validated-call.js';

/** Returns the HTTP exception for a language model failure, or the error itself when it is not one. */
export function toLanguageModelHttpError(error: unknown): unknown {
  if (error instanceof LanguageModelUnavailableError) {
    return new ServiceUnavailableException({
      code: ERROR_CODES.LANGUAGE_MODEL_UNAVAILABLE,
      message: error.message,
    });
  }
  if (error instanceof LanguageModelInvalidResponseError) {
    return new BadGatewayException({
      code: ERROR_CODES.LANGUAGE_MODEL_INVALID_RESPONSE,
      message: error.message,
    });
  }
  return error;
}
