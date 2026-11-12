import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ERROR_CODES } from '@gototalk/shared';
import type {
  AuthResponse,
  LoginRequest,
  Me,
  RegisterRequest,
} from '@gototalk/shared';
import { PasswordHasher } from './password-hasher.js';
import {
  InvalidRefreshTokenError,
  TokenReusedError,
} from './refresh-token.errors.js';
import { RefreshTokenService } from './refresh-token.service.js';
import { EmailTakenError, UsersRepository } from './users.repository.js';
import type { UserRecord } from './users.repository.js';

export interface AuthSession {
  response: AuthResponse;
  refreshToken: string;
}

export function toMe(user: UserRecord): Me {
  return {
    id: user.id,
    email: user.email,
    consentAt: user.consentAt === null ? null : user.consentAt.toISOString(),
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly hasher: PasswordHasher,
    private readonly refreshTokens: RefreshTokenService,
    private readonly jwt: JwtService,
  ) {}

  async register({ email, password }: RegisterRequest): Promise<AuthSession> {
    const passwordHash = await this.hasher.hash(password);
    let user: UserRecord;
    try {
      user = await this.users.create({ email, passwordHash });
    } catch (error) {
      if (error instanceof EmailTakenError) {
        throw new ConflictException({
          code: ERROR_CODES.EMAIL_TAKEN,
          message: 'This email is already registered',
        });
      }
      throw error;
    }
    return this.startSession(user);
  }

  async login({ email, password }: LoginRequest): Promise<AuthSession> {
    const user = await this.users.findByEmail(email);
    const valid = user
      ? await this.hasher.verify(user.passwordHash, password)
      : await this.hasher.verifyDummy(password);
    if (!user || !valid) {
      throw new UnauthorizedException({
        code: ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Invalid email or password',
      });
    }
    return this.startSession(user);
  }

  async refresh(rawToken: string): Promise<AuthSession> {
    let rotated: Awaited<ReturnType<RefreshTokenService['rotate']>>;
    try {
      rotated = await this.refreshTokens.rotate(rawToken);
    } catch (error) {
      if (
        error instanceof InvalidRefreshTokenError ||
        error instanceof TokenReusedError
      ) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      throw error;
    }
    const user = await this.users.findById(rotated.userId);
    if (!user) throw new UnauthorizedException('Invalid refresh token');
    return {
      response: await this.toResponse(user),
      refreshToken: rotated.token,
    };
  }

  logout(rawToken: string): Promise<void> {
    return this.refreshTokens.revoke(rawToken);
  }

  private async startSession(user: UserRecord): Promise<AuthSession> {
    const { token } = await this.refreshTokens.issue(user.id);
    return { response: await this.toResponse(user), refreshToken: token };
  }

  private async toResponse(user: UserRecord): Promise<AuthResponse> {
    return {
      accessToken: await this.jwt.signAsync({ sub: user.id }),
      user: toMe(user),
    };
  }
}
