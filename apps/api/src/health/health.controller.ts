import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { HealthResponse } from '@gototalk/shared';
import { HealthService } from './health.service.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Перевірка стану застосунку та з’єднання з БД' })
  @ApiOkResponse({
    description: 'Застосунок працює, БД відповідає на select 1',
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
    description: 'БД недоступна або не відповіла вчасно',
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
