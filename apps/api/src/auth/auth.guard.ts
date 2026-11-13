import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { AuthenticatedRequest } from './current-user.decorator.js';
import { IS_PUBLIC_KEY } from '../common/public.decorator.js';

const BEARER_PREFIX = 'Bearer ';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith(BEARER_PREFIX)) throw this.unauthorized();

    let payload: { sub?: unknown; exp?: unknown };
    try {
      payload = await this.jwt.verifyAsync<{ sub?: unknown; exp?: unknown }>(
        header.slice(BEARER_PREFIX.length),
        { algorithms: ['HS256'] },
      );
    } catch {
      throw this.unauthorized();
    }
    if (
      typeof payload.sub !== 'string' ||
      payload.sub === '' ||
      typeof payload.exp !== 'number'
    ) {
      throw this.unauthorized();
    }

    request.user = { id: payload.sub };
    return true;
  }

  private unauthorized(): UnauthorizedException {
    return new UnauthorizedException('Missing or invalid access token');
  }
}
