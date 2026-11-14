export class SpeechRecognitionUnavailableError extends Error {
  constructor() {
    super('The speech recognition service is unavailable');
    this.name = 'SpeechRecognitionUnavailableError';
  }
}
