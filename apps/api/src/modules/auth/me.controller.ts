import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DeleteAccountRequestSchema } from '@gototalk/shared';
import type { ConsentInfo, DeleteAccountRequest, Me } from '@gototalk/shared';
import {
  CurrentUser,
  requireUserId,
} from './decorators/current-user.decorator.js';
import type { AuthenticatedUser } from './decorators/current-user.decorator.js';
import { clearRefreshCookie } from './lib/refresh-cookie.js';
import type { CookieResponse } from './lib/refresh-cookie.js';
import { ZodBodyPipe } from '../../common/pipes/zod-body.pipe.js';
import { MeService } from './me.service.js';

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
    return this.me.getMe(requireUserId(user));
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
    return this.me.getConsentInfo(requireUserId(user));
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
    return this.me.grantConsent(requireUserId(user));
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete the account',
    description:
      'Requires the current password. Deletes the user; the database cascade removes all of their data. Clears the refresh cookie.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['password'],
      properties: {
        password: { type: 'string', minLength: 1, maxLength: 128 },
      },
    },
  })
  @ApiResponse({ status: 204, description: 'Account deleted' })
  @ApiResponse({ status: 400, description: 'VALIDATION_ERROR' })
  @ApiResponse({ status: 401, description: 'UNAUTHORIZED' })
  @ApiResponse({
    status: 403,
    description: 'INVALID_PASSWORD (403, not 401, so clients do not refresh)',
  })
  async deleteAccount(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body(new ZodBodyPipe(DeleteAccountRequestSchema))
    body: DeleteAccountRequest,
    @Res({ passthrough: true }) res: CookieResponse,
  ): Promise<void> {
    await this.me.deleteAccount(requireUserId(user), body.password);
    clearRefreshCookie(res);
  }
}
