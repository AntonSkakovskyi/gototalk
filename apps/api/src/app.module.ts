import { ConfigService } from '@nestjs/config';
import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppConfigModule } from './core/config/app-config.module.js';
import type { AppConfigOptions } from './core/config/app-config.module.js';
import type { Env } from './core/config/env.schema.js';
import { AnalysisModule } from './modules/analysis/analysis.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { DbModule } from './core/db/db.module.js';
import { DialogueModule } from './modules/dialogue/dialogue.module.js';
import { HealthModule } from './core/health/health.module.js';
import { MeModule } from './modules/me/me.module.js';
import { buildPinoHttpOptions } from './core/logger/pino-options.js';
import { ProfileModule } from './modules/profile/profile.module.js';
import { AdaptersModule } from './integrations/adapters.module.js';
import { ReportModule } from './modules/report/report.module.js';
import { SessionModule } from './modules/session/session.module.js';
import { VocabularyModule } from './modules/vocabulary/vocabulary.module.js';

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
        AdaptersModule,
        ProfileModule,
        SessionModule,
        AnalysisModule,
        DialogueModule,
        VocabularyModule,
        ReportModule,
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
