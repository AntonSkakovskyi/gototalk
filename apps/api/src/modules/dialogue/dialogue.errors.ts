export class SessionNotFoundError extends Error {
  constructor() {
    super('The session was not found');
    this.name = 'SessionNotFoundError';
  }
}

export class SessionFinishedError extends Error {
  constructor() {
    super('The session is already finished');
    this.name = 'SessionFinishedError';
  }
}

export class AnswerNotExpectedError extends Error {
  constructor() {
    super('The last utterance is not an assistant question');
    this.name = 'AnswerNotExpectedError';
  }
}
