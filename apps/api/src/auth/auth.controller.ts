import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { ApiBodyOptions } from '@nestjs/swagger';
import { LoginRequestSchema, RegisterRequestSchema } from '@gototalk/shared';
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
} from '@gototalk/shared';
import { ZodBodyPipe } from '../common/zod-body.pipe.js';
import { AuthService } from './auth.service.js';
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} from './refresh-cookie.js';
import type { CookieRequest, CookieResponse } from './refresh-cookie.js';
import { Public } from '../common/public.decorator.js';

const REGISTER_BODY: ApiBodyOptions = {
  schema: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 8, maxLength: 128 },
    },
  },
};

const LOGIN_BODY: ApiBodyOptions = {
  schema: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 1, maxLength: 128 },
    },
  },
};

@ApiTags('auth')
@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ApiOperation({
    summary: 'Register with email and password',
    description:
      'Creates the user, returns an access token and sets the refresh cookie.',
  })
  @ApiBody(REGISTER_BODY)
  @ApiResponse({ status: 201, description: 'User created' })
  @ApiResponse({ status: 400, description: 'VALIDATION_ERROR' })
  @ApiResponse({ status: 409, description: 'EMAIL_TAKEN' })
  async register(
    @Body(new ZodBodyPipe(RegisterRequestSchema)) body: RegisterRequest,
    @Res({ passthrough: true }) res: CookieResponse,
  ): Promise<AuthResponse> {
    const session = await this.auth.register(body);
    setRefreshCookie(res, session.refreshToken);
    return session.response;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Log in with email and password',
    description:
      'The same 401 INVALID_CREDENTIALS is returned for an unknown email and a wrong password.',
  })
  @ApiBody(LOGIN_BODY)
  @ApiResponse({ status: 200, description: 'Logged in' })
  @ApiResponse({ status: 400, description: 'VALIDATION_ERROR' })
  @ApiResponse({ status: 401, description: 'INVALID_CREDENTIALS' })
  async login(
    @Body(new ZodBodyPipe(LoginRequestSchema)) body: LoginRequest,
    @Res({ passthrough: true }) res: CookieResponse,
  ): Promise<AuthResponse> {
    const session = await this.auth.login(body);
    setRefreshCookie(res, session.refreshToken);
    return session.response;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate the refresh cookie and issue a new access token',
    description:
      'Reads the gtt_refresh cookie. A missing, expired or unknown token gives 401 and clears the cookie. Replaying a rotated token within 60 s issues another token; a later replay deletes all refresh tokens of the user and returns 401.',
  })
  @ApiResponse({ status: 200, description: 'Session renewed' })
  @ApiResponse({ status: 401, description: 'Refresh token rejected' })
  async refresh(
    @Req() req: CookieRequest,
    @Res({ passthrough: true }) res: CookieResponse,
  ): Promise<AuthResponse> {
    try {
      const token = readRefreshCookie(req);
      if (!token) throw new UnauthorizedException('Invalid refresh token');
      const session = await this.auth.refresh(token);
      setRefreshCookie(res, session.refreshToken);
      return session.response;
    } catch (error) {
      if (error instanceof UnauthorizedException) clearRefreshCookie(res);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete the current refresh token and clear the cookie',
    description: 'Idempotent: also succeeds without a cookie.',
  })
  @ApiResponse({ status: 204, description: 'Logged out' })
  async logout(
    @Req() req: CookieRequest,
    @Res({ passthrough: true }) res: CookieResponse,
  ): Promise<void> {
    const token = readRefreshCookie(req);
    if (token) await this.auth.logout(token);
    clearRefreshCookie(res);
  }
}
