import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiQuery } from '@nestjs/swagger';
import type { ApiBodyOptions } from '@nestjs/swagger';
import { z } from 'zod';

type OpenApiSchema = Extract<ApiBodyOptions, { schema: unknown }>['schema'];

interface ObjectJsonSchema {
  properties?: Record<string, unknown>;
  required?: string[];
}

function toJsonSchema(schema: z.ZodType, io: 'input' | 'output'): object {
  const jsonSchema: Record<string, unknown> = {
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
  const { properties = {} } = toJsonSchema(
    schema,
    'output',
  ) as ObjectJsonSchema;
  const { required = [] } = toJsonSchema(schema, 'input') as ObjectJsonSchema;
  return applyDecorators(
    ...Object.entries(properties).map(([name, property]) =>
      ApiQuery({
        name,
        required: required.includes(name),
        schema: asOpenApi(property as object),
      }),
    ),
  );
}
