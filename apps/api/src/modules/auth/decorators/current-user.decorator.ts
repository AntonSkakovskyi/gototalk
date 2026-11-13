import { createParamDecorator, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  id: string;
}

export interface AuthenticatedRequest {
  headers: { authorization?: string };
  user?: AuthenticatedUser;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser | undefined =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);

export function requireUserId(user: AuthenticatedUser | undefined): string {
  if (!user) throw new UnauthorizedException('Missing or invalid access token');
  return user.id;
}
