import {
  BadRequestException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ERROR_CODES, MAX_AUDIO_BYTES } from '@gototalk/shared';
import { describe, expect, it } from 'vitest';
import { AUDIO_UPLOAD_OPTIONS, toAudioUploadError } from './audio-upload.js';

function failure(message: string, code?: string): BadRequestException {
  const cause = Object.assign(new Error(message), code ? { code } : {});
  return new BadRequestException(message, { cause });
}

describe('AUDIO_UPLOAD_OPTIONS', () => {
  it('[TC-04-13] has no storage or dest, so multer keeps the file in memory', () => {
    expect(AUDIO_UPLOAD_OPTIONS).not.toHaveProperty('storage');
    expect(AUDIO_UPLOAD_OPTIONS).not.toHaveProperty('dest');
  });

  it('[TC-04-13] limits the file size, the number of files and text fields', () => {
    expect(AUDIO_UPLOAD_OPTIONS.limits).toEqual({
      fileSize: MAX_AUDIO_BYTES,
      files: 1,
      fields: 0,
    });
  });
});

describe('toAudioUploadError', () => {
  it('[TC-04-13] maps a multer size failure to 413 AUDIO_TOO_LARGE', () => {
    const error = toAudioUploadError(
      new PayloadTooLargeException('File too large', {
        cause: Object.assign(new Error('File too large'), {
          code: 'LIMIT_FILE_SIZE',
        }),
      }),
    );

    expect(error).toBeInstanceOf(PayloadTooLargeException);
    expect((error as PayloadTooLargeException).getResponse()).toMatchObject({
      code: ERROR_CODES.AUDIO_TOO_LARGE,
    });
  });

  it.each([
    ['a multer failure', failure('Unexpected field', 'LIMIT_UNEXPECTED_FILE')],
    [
      'a busboy failure without a multer code',
      failure('Unexpected end of form'),
    ],
  ])('[TC-04-02] maps %s to 400 VALIDATION_ERROR', (_name, input) => {
    const error = toAudioUploadError(input);

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('[TC-04-02] leaves other errors untouched', () => {
    const plain = new BadRequestException('Bad');
    const other = new NotFoundException();

    expect(toAudioUploadError(plain)).toBe(plain);
    expect(toAudioUploadError(other)).toBe(other);
    expect(toAudioUploadError('text')).toBe('text');
  });
});
