import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { ConsentInfo, Me } from '@gototalk/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/current-user.decorator.js';
import { MeService } from './me.service.js';

function requireUser(user: AuthenticatedUser | undefined): string {
  if (!user) throw new UnauthorizedException('Missing or invalid access token');
  return user.id;
}

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get()
  @ApiOperation({ summary: 'Get the current user' })
  @ApiResponse({ status: 200, description: 'Me { id, email, consentAt }' })
  @ApiResponse({ status: 401, description: 'UNAUTHORIZED' })
  getMe(@CurrentUser() user: AuthenticatedUser | undefined): Promise<Me> {
    return this.me.getMe(requireUser(user));
  }

  @Get('consent')
  @ApiOperation({
    summary: 'Get the consent state and the providers that receive speech',
  })
  @ApiResponse({
    status: 200,
    description: 'ConsentInfo { consentAt, providers: { stt, llm } }',
  })
  @ApiResponse({ status: 401, description: 'UNAUTHORIZED' })
  getConsent(
    @CurrentUser() user: AuthenticatedUser | undefined,
  ): Promise<ConsentInfo> {
    return this.me.getConsentInfo(requireUser(user));
  }

  @Post('consent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Record the consent',
    description:
      'Idempotent: consent_at is set only when it is empty, an existing value is never overwritten.',
  })
  @ApiResponse({ status: 200, description: 'Me with consentAt set' })
  @ApiResponse({ status: 401, description: 'UNAUTHORIZED' })
  grantConsent(
    @CurrentUser() user: AuthenticatedUser | undefined,
  ): Promise<Me> {
    return this.me.grantConsent(requireUser(user));
  }
}
