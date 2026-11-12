import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import type { Env } from '../config/env.schema.js';
import { AuthGuard } from './auth.guard.js';
import { CLOCK } from './clock.js';
import { PasswordHasher } from './password-hasher.js';

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
  providers: [
    PasswordHasher,
    { provide: CLOCK, useValue: () => new Date() },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [JwtModule, PasswordHasher, CLOCK],
})
export class AuthModule {}
