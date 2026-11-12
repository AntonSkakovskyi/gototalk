import 'reflect-metadata';
import type { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { inject } from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/configure-app.js';

export interface TestAppOverrides {
  env?: Record<string, string>;
  controllers?: Type<unknown>[];
  providers?: { token: unknown; useValue: unknown }[];
}

export function buildEnv(
  overrides: Record<string, string> = {},
): Record<string, string> {
  return {
    NODE_ENV: 'production',
    DATABASE_URL: inject('testDatabaseUrl'),
    PORT: '3456',
    LOG_LEVEL: 'silent',
    ...overrides,
  };
}

export async function createTestApp(
  overrides: TestAppOverrides = {},
): Promise<INestApplication> {
  let builder = Test.createTestingModule({
    imports: [AppModule.register({ env: buildEnv(overrides.env) })],
    controllers: overrides.controllers ?? [],
  });
  for (const { token, useValue } of overrides.providers ?? []) {
    builder = builder.overrideProvider(token).useValue(useValue);
  }
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}
