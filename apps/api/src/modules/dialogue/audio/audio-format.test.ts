import { describe, expect, it } from 'vitest';
import { detectAudioFormat } from './audio-format.js';

const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81]);
const ogg = Buffer.from('OggS\x00\x02\x00\x00\x00\x00', 'latin1');
const mp4 = Buffer.concat([
  Buffer.from([0x00, 0x00, 0x00, 0x18]),
  Buffer.from('ftypisom', 'latin1'),
]);

describe('detectAudioFormat', () => {
  it.each([
    ['audio/webm', webm],
    ['audio/ogg', ogg],
    ['audio/mp4', mp4],
  ] as const)(
    '[TC-04-13] accepts %s with a matching signature',
    (mime, bytes) => {
      expect(detectAudioFormat(mime, bytes)).toBe(mime);
    },
  );

  it('[TC-04-13] strips MIME parameters and normalises case and spaces', () => {
    expect(detectAudioFormat('audio/webm;codecs=opus', webm)).toBe(
      'audio/webm',
    );
    expect(detectAudioFormat('Audio/OGG ; codecs=opus', ogg)).toBe('audio/ogg');
  });

  it('[TC-04-13] rejects a MIME that does not match the signature', () => {
    expect(detectAudioFormat('audio/webm', ogg)).toBeNull();
    expect(detectAudioFormat('audio/ogg', mp4)).toBeNull();
    expect(detectAudioFormat('audio/mp4', webm)).toBeNull();
  });

  it('[TC-04-13] rejects an empty or too short buffer', () => {
    expect(detectAudioFormat('audio/webm', Buffer.alloc(0))).toBeNull();
    expect(detectAudioFormat('audio/webm', webm.subarray(0, 3))).toBeNull();
    expect(detectAudioFormat('audio/mp4', mp4.subarray(0, 7))).toBeNull();
  });

  it('[TC-04-13] rejects MIME types outside the whitelist', () => {
    expect(detectAudioFormat('audio/wav', webm)).toBeNull();
    expect(detectAudioFormat('video/webm', webm)).toBeNull();
    expect(detectAudioFormat('', webm)).toBeNull();
  });
});
