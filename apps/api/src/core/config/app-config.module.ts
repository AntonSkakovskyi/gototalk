import { fileURLToPath } from 'node:url';
import { ConfigModule } from '@nestjs/config';
import type { DynamicModule } from '@nestjs/common';
import { parseEnv } from './env.schema.js';

// The single .env lives at the monorepo root, five levels above apps/api/{src,dist}/core/config.
// A missing file is fine (CI sets variables externally); process env wins over .env.
const rootEnvPath = fileURLToPath(
  new URL('../../../../../.env', import.meta.url),
);

export interface AppConfigOptions {
  env?: Record<string, unknown>;
}

export class AppConfigModule {
  static forRoot(options: AppConfigOptions = {}): Promise<DynamicModule> {
    const { env } = options;
    return ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: rootEnvPath,
      ...(env && { ignoreEnvFile: true, ignoreEnvVars: true }),
      validate: (config) => parseEnv({ ...config, ...env }),
    });
  }
}
