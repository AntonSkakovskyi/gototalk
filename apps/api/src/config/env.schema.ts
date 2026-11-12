import { z } from 'zod';

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

const notImplemented = (real: string) => ({
  error: `provider "${real}" is not implemented yet, use "fake"`,
});

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
        .enum(['fake', 'deepgram'])
        .default('fake')
        .refine((value) => value === 'fake', notImplemented('deepgram')),
    ),
    LLM_PROVIDER: optional(
      z
        .enum(['fake', 'gemini'])
        .default('fake')
        .refine((value) => value === 'fake', notImplemented('gemini')),
    ),
    FAKE_STT_FAIL: optional(z.string().optional()),
    FAKE_LLM_FAIL: optional(z.string().optional()),
    DEV_KEEP_AUDIO: optional(
      z
        .enum(['true', 'false'])
        .default('false')
        .transform((value) => value === 'true'),
    ),
    DEV_AUDIO_DIR: optional(z.string().optional()),
  })
  .superRefine((env, ctx) => {
    if (env.DEV_KEEP_AUDIO && !env.DEV_AUDIO_DIR) {
      ctx.addIssue({
        code: 'custom',
        path: ['DEV_AUDIO_DIR'],
        message: 'is required when DEV_KEEP_AUDIO=true',
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
