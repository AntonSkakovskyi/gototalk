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

// Omitting storage and dest keeps the file in memory, so this route can never write audio to disk
export const AUDIO_UPLOAD_OPTIONS = {
  limits: { fileSize: MAX_AUDIO_BYTES, files: 1, fields: 0 },
};

export const AudioUpload = FileInterceptor('audio', AUDIO_UPLOAD_OPTIONS);

const VALIDATION_FAILURE = {
  code: 'VALIDATION_ERROR',
  message: 'Send either one audio file or a JSON text answer',
};

function causeOf(error: unknown): unknown {
  return error instanceof HttpException ? error.cause : undefined;
}

function multerCode(cause: unknown): string | undefined {
  if (typeof cause !== 'object' || cause === null) return undefined;
  return 'code' in cause && typeof cause.code === 'string'
    ? cause.code
    : undefined;
}

/** Gives the multer and busboy failures of the audio upload the application error codes. */
export function toAudioUploadError(error: unknown): unknown {
  const cause = causeOf(error);
  if (multerCode(cause) === 'LIMIT_FILE_SIZE') {
    return new PayloadTooLargeException({
      code: ERROR_CODES.AUDIO_TOO_LARGE,
      message: 'The audio file is too large',
    });
  }
  if (error instanceof BadRequestException && cause instanceof Error) {
    return new BadRequestException(VALIDATION_FAILURE);
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
