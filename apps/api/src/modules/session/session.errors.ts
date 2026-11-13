export class SessionOwnerMissingError extends Error {
  constructor() {
    super('The session owner does not exist');
    this.name = 'SessionOwnerMissingError';
  }
}
