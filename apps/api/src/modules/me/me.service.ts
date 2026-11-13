import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ERROR_CODES } from '@gototalk/shared';
import type { ConsentInfo, Me } from '@gototalk/shared';
import { toMe } from '../../auth/auth.service.js';
import { PasswordHasher } from '../../auth/password-hasher.js';
import { UsersRepository } from '../../auth/users.repository.js';
import type { UserRecord } from '../../auth/users.repository.js';
import type { Env } from '../../core/config/env.schema.js';

@Injectable()
export class MeService {
  constructor(
    private readonly users: UsersRepository,
    private readonly hasher: PasswordHasher,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async getMe(userId: string): Promise<Me> {
    return toMe(await this.requireUser(await this.users.findById(userId)));
  }

  async getConsentInfo(userId: string): Promise<ConsentInfo> {
    const user = this.requireUser(await this.users.findById(userId));
    return {
      consentAt: toMe(user).consentAt,
      providers: {
        stt: this.config.get('STT_PROVIDER', { infer: true }),
        llm: this.config.get('LLM_PROVIDER', { infer: true }),
      },
    };
  }

  async grantConsent(userId: string): Promise<Me> {
    return toMe(await this.requireUser(await this.users.grantConsent(userId)));
  }

  async deleteAccount(userId: string, password: string): Promise<void> {
    const user = this.requireUser(await this.users.findById(userId));
    if (!(await this.hasher.verify(user.passwordHash, password))) {
      throw new ForbiddenException({
        code: ERROR_CODES.INVALID_PASSWORD,
        message: 'The password is incorrect',
      });
    }
    await this.users.deleteById(userId);
  }

  private requireUser(user: UserRecord | null): UserRecord {
    if (!user) throw new UnauthorizedException('User no longer exists');
    return user;
  }
}
