import path from 'node:path';
import { z } from 'zod';
import { LLM_PROVIDERS, STT_PROVIDERS } from '@gototalk/shared';
import { findRepoRoot, isInside } from './repo-root.js';

// An empty value (`NAME=` in .env.example) means "not set".
const emptyToUndefined = (value: unknown): unknown =>
  value === '' ? undefined : value;

const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(emptyToUndefined, schema);

const LOG_LEVELS = [
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  'silent',
] as const;

export const FAKE_STT_FAIL_MODES = ['unavailable'] as const;
export const FAKE_LLM_FAIL_MODES = ['invalid_json', 'unavailable'] as const;

export type FakeSttFailMode = (typeof FAKE_STT_FAIL_MODES)[number];
export type FakeLlmFailMode = (typeof FAKE_LLM_FAIL_MODES)[number];

const notImplemented = (real: string) => ({
  error: `provider "${real}" is not implemented yet, use "fake"`,
});

// Checks both flavours so the same .env validates on any host OS
const isAbsolutePath = (value: string): boolean =>
  path.posix.isAbsolute(value) || path.win32.isAbsolute(value);

// Foreign-flavour paths (C:/x on Linux) resolve against cwd, so only native absolute paths are compared
export function validateAudioDir(
  keepAudio: boolean,
  dir: string | undefined,
  repoRoot: string | undefined,
): string | undefined {
  if (!keepAudio || !dir || !repoRoot || !path.isAbsolute(dir))
    return undefined;
  return isInside(repoRoot, dir)
    ? 'must be outside the repository (kept audio must not end up in git)'
    : undefined;
}

export const EnvSchema = z
  .object({
    NODE_ENV: optional(
      z.enum(['development', 'production', 'test']).default('development'),
    ),
    DATABASE_URL: z
      .string({ error: 'is required (postgres://user:password@host:5432/db)' })
      .regex(/^postgres(ql)?:\/\/\S+$/, {
        error: 'must be a postgres:// connection string',
      }),
    JWT_ACCESS_SECRET: z
      .string({ error: 'is required (at least 32 characters)' })
      .min(32, { error: 'must be at least 32 characters' }),
    TEST_DATABASE_URL: optional(
      z
        .string()
        .regex(/^postgres(ql)?:\/\/\S+$/, {
          error: 'must be a postgres:// connection string',
        })
        .optional(),
    ),
    PORT: optional(z.coerce.number().int().min(1).max(65535).default(3000)),
    LOG_LEVEL: optional(z.enum(LOG_LEVELS).default('info')),
    STT_PROVIDER: optional(
      z
        .enum(STT_PROVIDERS)
        .default('fake')
        .refine((value) => value === 'fake', notImplemented('deepgram')),
    ),
    LLM_PROVIDER: optional(
      z
        .enum(LLM_PROVIDERS)
        .default('fake')
        .refine((value) => value === 'fake', notImplemented('gemini')),
    ),
    FAKE_STT_FAIL: optional(z.enum(FAKE_STT_FAIL_MODES).optional()),
    FAKE_LLM_FAIL: optional(z.enum(FAKE_LLM_FAIL_MODES).optional()),
    DEV_KEEP_AUDIO: optional(
      z
        .enum(['true', 'false'])
        .default('false')
        .transform((value) => value === 'true'),
    ),
    DEV_AUDIO_DIR: optional(z.string().optional()),
  })
  .superRefine((env, ctx) => {
    if (env.DEV_KEEP_AUDIO && env.NODE_ENV !== 'development') {
      ctx.addIssue({
        code: 'custom',
        path: ['DEV_KEEP_AUDIO'],
        message: 'is allowed only when NODE_ENV=development',
      });
    }
    if (env.DEV_KEEP_AUDIO && !env.DEV_AUDIO_DIR) {
      ctx.addIssue({
        code: 'custom',
        path: ['DEV_AUDIO_DIR'],
        message: 'is required when DEV_KEEP_AUDIO=true',
      });
    }
    if (env.DEV_AUDIO_DIR && !isAbsolutePath(env.DEV_AUDIO_DIR)) {
      ctx.addIssue({
        code: 'custom',
        path: ['DEV_AUDIO_DIR'],
        message: 'must be an absolute path',
      });
    }
    const locationIssue = validateAudioDir(
      env.DEV_KEEP_AUDIO,
      env.DEV_AUDIO_DIR,
      findRepoRoot(process.cwd()),
    );
    if (locationIssue) {
      ctx.addIssue({
        code: 'custom',
        path: ['DEV_AUDIO_DIR'],
        message: locationIssue,
      });
    }
  });

export type Env = z.output<typeof EnvSchema>;

export class EnvValidationError extends Error {
  constructor(issues: readonly z.core.$ZodIssue[]) {
    const lines = issues.map(
      (issue) => `  - ${issue.path.join('.') || '(env)'}: ${issue.message}`,
    );
    super(`Invalid environment configuration:\n${lines.join('\n')}`);
    this.name = 'EnvValidationError';
  }
}

export function parseEnv(source: Record<string, unknown>): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(result.error.issues);
  }
  return result.data;
}
