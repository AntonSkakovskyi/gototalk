import {
  HintRequestSchema,
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
  PageQuerySchema,
  PlanSessionRequestSchema,
  StartSessionRequestSchema,
} from '@gototalk/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ApiZodBody, ApiZodQuery } from './api-zod.decorators.js';

const DocumentedParametersSchema = z.array(
  z.object({
    name: z.string().optional(),
    in: z.string(),
    required: z.boolean().optional(),
    schema: z.record(z.string(), z.unknown()).optional(),
  }),
);

type DocumentedParameter = z.infer<typeof DocumentedParametersSchema>[number];

function parametersOf(decorator: MethodDecorator): DocumentedParameter[] {
  class Probe {
    handler(): void {}
  }
  const descriptor: TypedPropertyDescriptor<() => void> = {
    value: Probe.prototype.handler,
  };
  decorator(Probe.prototype, 'handler', descriptor);
  return DocumentedParametersSchema.parse(
    Reflect.getMetadata('swagger/apiParameters', Probe.prototype.handler),
  );
}

function bodySchemaOf(schema: z.ZodType): Record<string, unknown> {
  const [body] = parametersOf(ApiZodBody(schema));
  return body?.schema ?? {};
}

describe('ApiZodBody', () => {
  it('documents the request body with the schema generated from Zod', () => {
    const [body] = parametersOf(ApiZodBody(StartSessionRequestSchema));

    expect(body?.in).toBe('body');
    expect(body?.schema).toMatchObject({
      type: 'object',
      required: ['topic', 'topicSource', 'questions'],
      properties: {
        topic: { type: 'string', minLength: 1 },
        questions: { type: 'array', minItems: 5, maxItems: 5 },
        feedbackMode: { default: 'immediate' },
      },
    });
  });

  it('keeps optional fields optional and documents array limits', () => {
    expect(bodySchemaOf(PlanSessionRequestSchema)).toMatchObject({
      type: 'object',
      properties: {
        previousTopics: { type: 'array', maxItems: 3 },
        customTopic: { type: 'string' },
      },
    });
    expect(bodySchemaOf(PlanSessionRequestSchema)).not.toHaveProperty(
      'required',
    );
  });

  it('documents a discriminated union as oneOf', () => {
    expect(bodySchemaOf(HintRequestSchema)).toMatchObject({
      oneOf: [
        { properties: { kind: { enum: ['phrase_start'] } } },
        {
          properties: { kind: { enum: ['translation'] } },
          required: ['kind', 'word'],
        },
      ],
    });
  });

  it('does not throw for coerce, default, refine and transform', () => {
    const schema = z
      .object({
        count: z.coerce.number().int().min(1),
        label: z.string().default('x'),
        slug: z.string().transform((value) => value.trim()),
        tag: z.string().optional(),
      })
      .refine((value) => value.count > 0);

    const documented = bodySchemaOf(schema);

    expect(documented).toMatchObject({
      type: 'object',
      properties: {
        count: { type: 'integer', minimum: 1 },
        label: { default: 'x' },
        slug: { type: 'string' },
      },
    });
    expect(documented).not.toHaveProperty('$schema');
  });
});

describe('ApiZodQuery', () => {
  it('adds one query parameter per property of the schema', () => {
    const parameters = parametersOf(ApiZodQuery(PageQuerySchema));

    expect(parameters.map((p) => [p.name, p.in, p.required])).toEqual([
      ['cursor', 'query', false],
      ['limit', 'query', false],
    ]);
  });

  it('documents the numeric limit with its bounds and default', () => {
    const limit = parametersOf(ApiZodQuery(PageQuerySchema)).find(
      (p) => p.name === 'limit',
    );

    expect(limit?.schema).toMatchObject({
      type: 'integer',
      minimum: 1,
      maximum: PAGE_SIZE_MAX,
      default: PAGE_SIZE_DEFAULT,
    });
  });

  it('throws when the schema is not an object schema', () => {
    expect(() => ApiZodQuery(z.string())).toThrow(
      'ApiZodQuery requires a Zod object schema',
    );
  });

  it('marks a property without a default or optional as required', () => {
    const parameters = parametersOf(
      ApiZodQuery(
        z.object({
          from: z.coerce.date(),
          size: z.coerce.number().default(3),
          q: z.string().optional(),
        }),
      ),
    );

    expect(parameters.map((p) => [p.name, p.required])).toEqual([
      ['from', true],
      ['size', false],
      ['q', false],
    ]);
  });
});
