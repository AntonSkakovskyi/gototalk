import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SessionReportSchema } from '@gototalk/shared';
import type { SessionReport } from '@gototalk/shared';
import { ApiZodResponse } from '../../common/swagger/api-zod.decorators.js';
import {
  CurrentUser,
  requireUserId,
} from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator.js';
import { RequiresConsent } from '../auth/decorators/requires-consent.decorator.js';
import { ReportService } from './report.service.js';

@ApiTags('report')
@ApiBearerAuth()
@Controller('sessions')
export class ReportController {
  constructor(private readonly report: ReportService) {}

  @Get(':id/report')
  @RequiresConsent()
  @ApiOperation({
    summary: 'Get the report of a finished session',
    description:
      'Returns the answer count, duration, summary, mistake categories without the ones marked as not a mistake (most frequent first, with theory links) and the words of the session. The summary is generated on the first read if it is missing and then stored; when the model is unavailable the summary has status unavailable and the next read retries. A session without answers has summary status no_answers. Consent is required because the read can call the language model. 404 SESSION_NOT_FOUND for a foreign, unknown or malformed id.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiZodResponse(SessionReportSchema, {
    description:
      'SessionReport { sessionId, answers, durationSeconds, summary, categories, words }',
  })
  @ApiResponse({ status: 401, description: 'UNAUTHORIZED' })
  @ApiResponse({ status: 403, description: 'CONSENT_REQUIRED' })
  @ApiResponse({ status: 404, description: 'SESSION_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'SESSION_NOT_FINISHED' })
  get(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id') id: string,
  ): Promise<SessionReport> {
    return this.report.get(requireUserId(user), id);
  }
}
