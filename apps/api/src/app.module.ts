import { ConfigService } from '@nestjs/config';
import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppConfigModule } from './config/app-config.module.js';
import type { AppConfigOptions } from './config/app-config.module.js';
import type { Env } from './config/env.schema.js';
import { buildPinoHttpOptions } from './logger/pino-options.js';

// Корінь застосунку; доменні модулі (db, health, ports…) додаються в наступних задачах.
@Module({})
export class AppModule {
  static register(options: AppConfigOptions = {}): DynamicModule {
    return {
      module: AppModule,
      imports: [
        AppConfigModule.forRoot(options),
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
