export class LanguageModelUnavailableError extends Error {
  constructor() {
    super('The language model is unavailable');
    this.name = 'LanguageModelUnavailableError';
  }
}
