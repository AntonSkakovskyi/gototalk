import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiQuery, ApiResponse } from '@nestjs/swagger';
import type { ApiBodyOptions } from '@nestjs/swagger';
import { z } from 'zod';

type OpenApiSchema = Extract<ApiBodyOptions, { schema: unknown }>['schema'];

function toJsonSchema(
  schema: z.ZodType,
  io: 'input' | 'output',
): z.core.JSONSchema.BaseSchema {
  const jsonSchema = {
    ...z.toJSONSchema(schema, {
      target: 'openapi-3.0',
      io,
      unrepresentable: 'any',
    }),
  };
  delete jsonSchema.$schema;
  return jsonSchema;
}

// Zod's JSON Schema type is looser than Nest's SchemaObject, but the output is OpenAPI 3.0 by construction
function asOpenApi(jsonSchema: object): OpenApiSchema {
  return jsonSchema as OpenApiSchema;
}

export function ApiZodBody(schema: z.ZodType): MethodDecorator {
  return ApiBody({ schema: asOpenApi(toJsonSchema(schema, 'input')) });
}

// Properties come from the output side so a coerced limit is documented as a bounded number
export function ApiZodQuery(schema: z.ZodType): MethodDecorator {
  const { properties } = toJsonSchema(schema, 'output');
  if (!properties) {
    throw new Error('ApiZodQuery requires a Zod object schema');
  }
  const { required = [] } = toJsonSchema(schema, 'input');
  return applyDecorators(
    ...Object.entries(properties).flatMap(([name, property]) =>
      typeof property === 'object'
        ? [
            ApiQuery({
              name,
              required: required.includes(name),
              schema: asOpenApi(property),
            }),
          ]
        : [],
    ),
  );
}

interface ApiZodResponseOptions {
  status?: number;
  description?: string;
}

export function ApiZodResponse(
  schema: z.ZodType,
  { status = 200, description }: ApiZodResponseOptions = {},
): MethodDecorator {
  return ApiResponse({
    status,
    description,
    schema: asOpenApi(toJsonSchema(schema, 'output')),
  });
}
