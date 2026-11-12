import { ConfigService } from '@nestjs/config';
import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppConfigModule } from './config/app-config.module.js';
import type { AppConfigOptions } from './config/app-config.module.js';
import type { Env } from './config/env.schema.js';
import { AnalysisModule } from './analysis/analysis.module.js';
import { AuthModule } from './auth/auth.module.js';
import { DbModule } from './db/db.module.js';
import { DialogueModule } from './dialogue/dialogue.module.js';
import { HealthModule } from './health/health.module.js';
import { MeModule } from './me/me.module.js';
import { buildPinoHttpOptions } from './logger/pino-options.js';
import { ProfileModule } from './profile/profile.module.js';
import { ProvidersModule } from './providers/providers.module.js';
import { SessionModule } from './session/session.module.js';

@Module({})
export class AppModule {
  static register(options: AppConfigOptions = {}): DynamicModule {
    return {
      module: AppModule,
      imports: [
        AppConfigModule.forRoot(options),
        DbModule,
        AuthModule,
        MeModule,
        HealthModule,
        ProvidersModule,
        ProfileModule,
        SessionModule,
        AnalysisModule,
        DialogueModule,
        LoggerModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService<Env, true>) => ({
            pinoHttp: buildPinoHttpOptions({
              NODE_ENV: config.get('NODE_ENV', { infer: true }),
              LOG_LEVEL: config.get('LOG_LEVEL', { infer: true }),
            }),
          }),
        }),
      ],
    };
  }
}
