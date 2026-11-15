export class LanguageModelUnavailableError extends Error {
  constructor() {
    super('The language model is unavailable');
    this.name = 'LanguageModelUnavailableError';
  }
}

export class LanguageModelInvalidResponseError extends Error {
  constructor() {
    super('The language model returned an invalid response');
    this.name = 'LanguageModelInvalidResponseError';
  }
}
