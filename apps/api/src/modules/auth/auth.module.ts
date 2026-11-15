import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import type { Env } from '../../core/config/env.schema.js';
import { AuthController } from './auth.controller.js';
import { MeController } from './me.controller.js';
import { MeService } from './me.service.js';
import { AuthGuard } from './guards/auth.guard.js';
import { AuthService } from './auth.service.js';
import { CLOCK } from './lib/clock.js';
import { DrizzleRefreshTokensRepository } from './persistence/drizzle-refresh-tokens.repository.js';
import { PasswordHasher } from './lib/password-hasher.js';
import { RefreshTokenService } from './refresh-token.service.js';
import { REFRESH_TOKENS_REPOSITORY } from './persistence/refresh-tokens.repository.js';
import { UsersRepository } from './persistence/users.repository.js';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

// Global: guard dependencies must resolve outside AuthModule for @RequiresConsent()
@Global()
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
  controllers: [AuthController, MeController],
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
    MeService,
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
