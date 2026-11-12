import { fileURLToPath } from 'node:url';
import { ConfigModule } from '@nestjs/config';
import type { DynamicModule } from '@nestjs/common';
import { parseEnv } from './env.schema.js';

// Єдиний .env лежить у корені монорепо: apps/api/{src,dist}/config → корінь на чотири рівні вище.
// Відсутній файл не помилка (CI, змінні задані ззовні): @nestjs/config його пропускає.
const rootEnvPath = fileURLToPath(new URL('../../../../.env', import.meta.url));

export interface AppConfigOptions {
  /**
   * Явний набір змінних замість .env і process.env (для тестів).
   * Без нього конфіг береться з кореневого .env, поверх якого діють змінні процесу.
   */
  env?: Record<string, unknown>;
}

export class AppConfigModule {
  static forRoot(options: AppConfigOptions = {}): Promise<DynamicModule> {
    const { env } = options;
    return ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: rootEnvPath,
      ...(env && { ignoreEnvFile: true, ignoreEnvVars: true }),
      // Повертаємо лише розібране Zod-ом: ConfigService віддає саме ці типізовані значення
      validate: (config) => parseEnv({ ...config, ...env }),
    });
  }
}
