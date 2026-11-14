import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

const WEBM_SIGNATURE = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);

export function webmAudio(size = 64): Buffer {
  return Buffer.concat([WEBM_SIGNATURE, Buffer.alloc(size - 4, 7)]);
}

export interface AudioUploadOptions {
  bytes?: Buffer;
  mime?: string;
}

export function postAudio(
  app: INestApplication,
  token: string,
  sessionId: string,
  {
    bytes = webmAudio(),
    mime = 'audio/webm;codecs=opus',
  }: AudioUploadOptions = {},
) {
  return request(app.getHttpServer())
    .post(`/api/sessions/${sessionId}/utterances`)
    .set('Authorization', `Bearer ${token}`)
    .attach('audio', bytes, { filename: 'answer.webm', contentType: mime });
}
