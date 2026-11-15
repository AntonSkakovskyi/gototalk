import { Controller, Get } from '@nestjs/common';
import {
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HealthResponseSchema } from '@gototalk/shared';
import type { HealthResponse } from '@gototalk/shared';
import { ApiZodResponse } from '../../common/swagger/api-zod.decorators.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { HealthService } from './health.service.js';

@Public()
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @ApiOperation({
    summary: 'Check application health and database connectivity',
  })
  @ApiZodResponse(HealthResponseSchema, {
    description: 'The application is running and the database answers select 1',
  })
  @ApiServiceUnavailableResponse({
    description: 'The database is unavailable or did not respond in time',
    schema: {
      type: 'object',
      required: ['error'],
      properties: {
        error: {
          type: 'object',
          required: ['code', 'message'],
          properties: {
            code: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
      example: {
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Service Unavailable',
        },
      },
    },
  })
  check(): Promise<HealthResponse> {
    return this.health.check();
  }
}
