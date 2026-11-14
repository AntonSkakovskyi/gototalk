import {
  BadRequestException,
  HttpException,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ERROR_CODES, MAX_AUDIO_BYTES } from '@gototalk/shared';
import { catchError, throwError } from 'rxjs';
import type { Observable } from 'rxjs';

/** Shape of the file multer keeps in memory; only the fields this module reads. */
export interface UploadedAudio {
  buffer: Buffer;
  mimetype: string;
}

// No storage or dest: multer then keeps the file in memory and never touches the disk
export const AudioUpload = FileInterceptor('audio', {
  limits: { fileSize: MAX_AUDIO_BYTES, files: 1, fields: 0 },
});

function multerCode(error: unknown): string | undefined {
  if (!(error instanceof HttpException)) return undefined;
  const { cause } = error;
  if (typeof cause !== 'object' || cause === null) return undefined;
  return 'code' in cause && typeof cause.code === 'string'
    ? cause.code
    : undefined;
}

/** Gives the multer failures of the audio upload the application error codes. */
export function toAudioUploadError(error: unknown): unknown {
  const code = multerCode(error);
  if (code === 'LIMIT_FILE_SIZE') {
    return new PayloadTooLargeException({
      code: ERROR_CODES.AUDIO_TOO_LARGE,
      message: 'The audio file is too large',
    });
  }
  if (code !== undefined && error instanceof BadRequestException) {
    return new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Send either one audio file or a JSON text answer',
    });
  }
  return error;
}

@Injectable()
export class AudioUploadErrors implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next
      .handle()
      .pipe(catchError((error) => throwError(() => toAudioUploadError(error))));
  }
}
