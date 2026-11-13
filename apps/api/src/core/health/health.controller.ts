import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { HealthResponse } from '@gototalk/shared';
import { Public } from '../../common/public.decorator.js';
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
  @ApiOkResponse({
    description: 'The application is running and the database answers select 1',
    schema: {
      type: 'object',
      required: ['status', 'db'],
      properties: {
        status: { type: 'string', enum: ['ok'] },
        db: { type: 'string', enum: ['ok'] },
      },
      example: { status: 'ok', db: 'ok' },
    },
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
