import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import type { Env } from '../config/env.schema.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { CLOCK } from './clock.js';
import { DrizzleRefreshTokensRepository } from './drizzle-refresh-tokens.repository.js';
import { PasswordHasher } from './password-hasher.js';
import { RefreshTokenService } from './refresh-token.service.js';
import { REFRESH_TOKENS_REPOSITORY } from './refresh-tokens.repository.js';
import { UsersRepository } from './users.repository.js';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: {
          algorithm: 'HS256',
          expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    PasswordHasher,
    { provide: CLOCK, useValue: () => new Date() },
    {
      provide: REFRESH_TOKENS_REPOSITORY,
      useClass: DrizzleRefreshTokensRepository,
    },
    RefreshTokenService,
    UsersRepository,
    AuthService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [
    JwtModule,
    PasswordHasher,
    CLOCK,
    RefreshTokenService,
    UsersRepository,
  ],
})
export class AuthModule {}
