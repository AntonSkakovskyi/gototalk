import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { ERROR_CODES } from '@gototalk/shared';
import type { AuthenticatedRequest } from './current-user.decorator.js';
import { UsersRepository } from './users.repository.js';

@Injectable()
export class ConsentGuard implements CanActivate {
  constructor(private readonly users: UsersRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Missing or invalid access token');
    }

    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('User no longer exists');
    if (user.consentAt === null) {
      throw new ForbiddenException({
        code: ERROR_CODES.CONSENT_REQUIRED,
        message: 'Consent to data processing is required',
      });
    }
    return true;
  }
}
