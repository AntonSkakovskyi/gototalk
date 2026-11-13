export class InvalidRefreshTokenError extends Error {
  constructor() {
    super('Refresh token is unknown or expired');
    this.name = 'InvalidRefreshTokenError';
  }
}

export class TokenReusedError extends Error {
  constructor() {
    super('A revoked refresh token was presented again');
    this.name = 'TokenReusedError';
  }
}
